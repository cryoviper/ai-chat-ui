// Serverless proxy for the chat. The API key lives only here (server side),
// so it is never shipped to the browser.
// Netlify Functions v2: https://docs.netlify.com/functions/get-started/

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map(); // best-effort rate limit per warm instance

const SYSTEM = "You are Lumen, a friendly and concise assistant. Use Markdown for code and lists. Keep answers short unless asked for detail.";

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_WINDOW;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { error: "The server has no API key set yet.", code: "NO_KEY" });

  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (limited(ip)) return json(429, { error: "Slow down a little. Try again in a minute." });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const messages = Array.isArray(body?.messages) ? body.messages.slice(-MAX_MESSAGES) : null;
  if (!messages?.length) return json(400, { error: "No messages" });
  const contents = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return json(400, { error: "Bad message format" });
    }
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, MAX_CHARS) }] });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM }] },
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
      }),
      signal: req.signal,
    }
  );

  if (!upstream.ok || !upstream.body) {
    console.error("Upstream error", upstream.status, await upstream.text().catch(() => ""));
    return json(502, { error: "The AI service didn't respond. Try again." });
  }

  // Turn Gemini's SSE stream into a plain text stream for the client.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const data = JSON.parse(line.slice(5));
              const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              /* ignore partial lines */
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config = { path: "/api/chat" };
