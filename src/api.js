// Chat client. Talks to the serverless proxy at /api/chat (see netlify/functions/chat.mjs).
// If no backend is available (e.g. the GitHub Pages build), it falls back to a local
// demo mode so the UI can still be tried out.

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

export class DemoModeError extends Error {}

export async function streamChat(messages, { signal, onToken }) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new DemoModeError("offline");
  }

  const type = res.headers.get("content-type") || "";
  // 404/405 or an HTML page means there is no API here (static hosting).
  if (res.status === 404 || res.status === 405 || type.includes("text/html")) throw new DemoModeError("no-backend");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "NO_KEY") throw new DemoModeError("no-key");
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onToken(full);
  }
  if (!full.trim()) throw new Error("The AI returned an empty answer. Try rephrasing.");
  return full;
}

// ---------- demo mode ----------
const DEMO = [
  {
    match: /react|hook|component|state/i,
    text: "Here's a quick example of a **custom React hook** that debounces a value:\n\n```js\nimport { useEffect, useState } from \"react\";\n\nexport function useDebounce(value, ms = 300) {\n  const [v, setV] = useState(value);\n  useEffect(() => {\n    const t = setTimeout(() => setV(value), ms);\n    return () => clearTimeout(t);\n  }, [value, ms]);\n  return v;\n}\n```\n\nUse it for search boxes so you don't send a request on every keystroke.",
  },
  {
    match: /plan|study|learn|roadmap/i,
    text: "A simple 4-week plan:\n\n1. **Week 1:** JavaScript basics: arrays, objects, functions, `fetch`\n2. **Week 2:** DOM and events, build a small app\n3. **Week 3:** React components, props, state and hooks\n4. **Week 4:** Build and deploy one full project\n\nTip: ship something small every week, even if it's not perfect.",
  },
  {
    match: /email|message|write/i,
    text: "Here's a short draft:\n\n> Hi Sam, thanks for your time today. I've attached the updated design with the changes we discussed. Let me know if anything needs another pass. Best, Praveen\n\nWant it more formal or more casual?",
  },
];
const FALLBACK =
  "I'm running in **demo mode** right now, so I can only give sample answers.\n\nWhen this app is deployed with an API key on the server, replies come from a real AI model and stream in word by word, just like this one.\n\nTry asking about *React hooks*, a *study plan* or *writing an email*.";

export async function demoReply(messages, { signal, onToken }) {
  const last = messages[messages.length - 1]?.content || "";
  const text = (DEMO.find((d) => d.match.test(last)) || { text: FALLBACK }).text;
  let out = "";
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    out += w;
    onToken(out);
    await new Promise((r) => setTimeout(r, 18));
  }
  return out;
}
