import { useEffect, useRef, useState } from "react";
import Markdown from "./markdown.jsx";
import { streamChat, demoReply, DemoModeError } from "./api.js";

const KEY = "lumen.chats.v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const SUGGESTIONS = [
  "Write a custom React hook that debounces a value",
  "Make me a 4-week plan to learn JavaScript",
  "Help me write a short follow-up email",
  "Explain the difference between let, const and var",
];

function loadChats() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v)) return v;
  } catch { /* ignore */ }
  return [];
}
const newChat = () => ({ id: uid(), title: "New chat", messages: [], updated: Date.now() });

export default function App() {
  const [chats, setChats] = useState(() => {
    const c = loadChats();
    return c.length ? c : [newChat()];
  });
  const [activeId, setActiveId] = useState(() => chats[0].id);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const taRef = useRef(null);

  const chat = chats.find((c) => c.id === activeId) || chats[0];

  useEffect(() => {
    try {
      // Don't persist empty chats.
      localStorage.setItem(KEY, JSON.stringify(chats.filter((c) => c.messages.length)));
    } catch { /* ignore */ }
  }, [chats]);

  // Auto-scroll while streaming, unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  const update = (id, fn) => setChats((list) => list.map((c) => (c.id === id ? { ...fn(c), updated: Date.now() } : c)));

  async function send(text, base = chat.messages) {
    const content = text.trim();
    if (!content || busy) return;
    setError("");
    setInput("");
    const id = chat.id;
    const userMsg = { id: uid(), role: "user", content };
    const botMsg = { id: uid(), role: "assistant", content: "" };
    const history = [...base, userMsg];
    update(id, (c) => ({ ...c, title: c.messages.length ? c.title : content.slice(0, 48), messages: [...history, botMsg] }));
    stickRef.current = true;
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onToken = (full) =>
      update(id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === botMsg.id ? { ...m, content: full } : m)) }));

    try {
      if (demo) await demoReply(history, { signal: ctrl.signal, onToken });
      else {
        try {
          await streamChat(history, { signal: ctrl.signal, onToken });
        } catch (err) {
          if (!(err instanceof DemoModeError)) throw err;
          setDemo(true);
          await demoReply(history, { signal: ctrl.signal, onToken });
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong.");
        // drop the empty assistant bubble
        update(id, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== botMsg.id || m.content) }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      taRef.current?.focus();
    }
  }

  function regenerate() {
    const msgs = chat.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = msgs.lastIndexOf(lastUser);
    const base = msgs.slice(0, idx);
    update(chat.id, (c) => ({ ...c, messages: base }));
    send(lastUser.content, base);
  }

  function startNew() {
    if (busy) abortRef.current?.abort();
    const empty = chats.find((c) => !c.messages.length);
    if (empty) setActiveId(empty.id);
    else {
      const c = newChat();
      setChats((l) => [c, ...l]);
      setActiveId(c.id);
    }
    setDrawer(false);
    setError("");
    setTimeout(() => taRef.current?.focus(), 0);
  }

  function remove(id) {
    setChats((list) => {
      const next = list.filter((c) => c.id !== id);
      if (!next.length) next.push(newChat());
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  // auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const sorted = [...chats].sort((a, b) => b.updated - a.updated);
  const last = chat.messages[chat.messages.length - 1];

  return (
    <div className={`shell ${drawer ? "drawer-open" : ""}`}>
      <aside className="side" aria-label="Chats">
        <div className="side-top">
          <div className="brand"><span className="orb" aria-hidden="true" />Lumen</div>
          <button className="icon-btn only-mobile" type="button" aria-label="Close chats" onClick={() => setDrawer(false)}>✕</button>
        </div>
        <button className="new" type="button" onClick={startNew}>+ New chat</button>
        <nav className="history">
          {sorted.filter((c) => c.messages.length).map((c) => (
            <div key={c.id} className={`hist ${c.id === chat.id ? "on" : ""}`}>
              <button type="button" className="hist-btn" onClick={() => { setActiveId(c.id); setDrawer(false); setError(""); }}>{c.title}</button>
              <button type="button" className="hist-del" aria-label={`Delete chat ${c.title}`} onClick={() => remove(c.id)}>×</button>
            </div>
          ))}
          {!chats.some((c) => c.messages.length) && <p className="hint">Your chats will show up here. They're saved in this browser only.</p>}
        </nav>
        <p className="side-foot">Built by <a href="https://github.com/cryoviper" target="_blank" rel="noopener">Praveen Sinwar</a></p>
      </aside>
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <main className="main">
        <header className="bar">
          <button className="icon-btn only-mobile" type="button" aria-label="Open chats" onClick={() => setDrawer(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          </button>
          <h1>{chat.messages.length ? chat.title : "New chat"}</h1>
          {demo && <span className="pill" title="No API key on this deployment, so answers are samples">Demo mode</span>}
        </header>

        <div
          className="thread"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          aria-live="polite"
        >
          {chat.messages.length === 0 ? (
            <div className="welcome">
              <span className="orb big" aria-hidden="true" />
              <h2>What can I help with?</h2>
              <div className="suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="msgs">
              {chat.messages.map((m) => (
                <article key={m.id} className={`msg ${m.role}`} aria-label={m.role === "user" ? "You" : "Lumen"}>
                  {m.role === "assistant" && <span className="orb sm" aria-hidden="true" />}
                  <div className="bubble">
                    {m.role === "assistant" ? (
                      m.content ? <Markdown text={m.content} /> : <span className="typing" aria-label="Thinking"><i /><i /><i /></span>
                    ) : (
                      <p>{m.content}</p>
                    )}
                  </div>
                </article>
              ))}
              {error && (
                <div className="err" role="alert">
                  {error} <button type="button" onClick={regenerate}>Try again</button>
                </div>
              )}
              {!busy && last?.role === "assistant" && last.content && (
                <div className="after">
                  <button type="button" onClick={regenerate}>↻ Regenerate</button>
                </div>
              )}
            </div>
          )}
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label className="sr" htmlFor="msg">Message</label>
          <textarea
            id="msg"
            ref={taRef}
            rows={1}
            value={input}
            maxLength={4000}
            placeholder="Message Lumen"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          {busy ? (
            <button type="button" className="send stop" aria-label="Stop generating" onClick={() => abortRef.current?.abort()}>
              <span />
            </button>
          ) : (
            <button type="submit" className="send" aria-label="Send" disabled={!input.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          )}
        </form>
        <p className="note">AI can make mistakes. Check important info.</p>
      </main>
    </div>
  );
}
