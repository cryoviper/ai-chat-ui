# Lumen · AI Chat

A streaming AI chat app built with React. Answers stream in word by word from a serverless API proxy, so the AI key never touches the browser.

**Live (demo mode):** https://cryoviper.github.io/ai-chat-ui/
**Live (real AI):** deploy to Netlify with your own key (steps below)

## Features

- Streaming responses with a **Stop** button (uses `AbortController`)
- Chat history sidebar saved in `localStorage`; new chat, switch, delete
- Safe Markdown rendering: code blocks with copy button, lists, links, bold, italic. Built as React elements, **no `innerHTML`**, and `javascript:` links are blocked
- Regenerate last answer, retry on error, auto-scroll that pauses when you scroll up
- Auto-growing input: `Enter` to send, `Shift + Enter` for a new line
- Mobile drawer, light and dark mode
- **Demo mode:** if no backend or key is found (like on GitHub Pages), it switches to sample answers and shows a "Demo mode" badge

## Architecture

```
Browser (React)  ──POST /api/chat──▶  Netlify Function  ──▶  Gemini API
      ▲                                (key in env var)          │
      └──────────── plain text stream ◀──────────────────────────┘
```

The function in `netlify/functions/chat.mjs`:
- Keeps `GEMINI_API_KEY` server side only
- Validates input (roles, message count, length)
- Has a simple per-IP rate limit
- Converts Gemini's SSE stream into a plain text stream

## Tech

React 18, Vite, Netlify Functions (v2), Gemini API, Vitest.

## Run locally

```bash
git clone https://github.com/cryoviper/ai-chat-ui.git
cd ai-chat-ui
npm install
npm test
npm run dev          # UI only, runs in demo mode
```

To run with the real AI locally, use the [Netlify CLI](https://docs.netlify.com/cli/get-started/): put your key in `.env` (see `.env.example`), then run `npx netlify dev`.

## Deploy with real AI (free)

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. On [Netlify](https://app.netlify.com), choose **Add new site → Import from Git** and pick this repo (build settings come from `netlify.toml`)
3. In **Site settings → Environment variables**, add `GEMINI_API_KEY`
4. Redeploy. The "Demo mode" badge disappears once the key works.

## What I learned

- Why API keys must stay on a server, and how to proxy requests safely
- Reading streamed responses with `ReadableStream` and cancelling them
- Rendering untrusted text safely and writing tests for it

---

Built by [Praveen Sinwar](https://github.com/cryoviper).
