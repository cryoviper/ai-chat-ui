// Tiny, safe Markdown renderer: builds React elements, never uses innerHTML.
// Supports: fenced code blocks, headings, bullet/numbered lists, blockquotes,
// paragraphs, **bold**, *italic*, `inline code` and [links](https://...).
import { useState } from "react";

const SAFE_URL = /^(https?:|mailto:)/i;

export function parseBlocks(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++; // skip closing fence (or end)
      blocks.push({ type: "code", lang: fence[1] || "", text: code.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) { blocks.push({ type: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: q.join(" ") });
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|>\s?|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

export function inline(text, keyBase = "i") {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, m, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${n++}`;
    if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    else {
      const [, label, url] = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
      out.push(SAFE_URL.test(url) ? <a key={k} href={url} target="_blank" rel="noopener noreferrer">{label}</a> : label);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ lang, text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="code">
      <div className="code-bar">
        <span>{lang || "code"}</span>
        <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre><code>{text}</code></pre>
    </div>
  );
}

export default function Markdown({ text }) {
  return parseBlocks(text).map((b, i) => {
    const k = `b${i}`;
    switch (b.type) {
      case "code": return <CodeBlock key={k} lang={b.lang} text={b.text} />;
      case "h": { const H = `h${Math.min(b.level + 2, 6)}`; return <H key={k}>{inline(b.text, k)}</H>; }
      case "ul": return <ul key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ul>;
      case "ol": return <ol key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ol>;
      case "quote": return <blockquote key={k}>{inline(b.text, k)}</blockquote>;
      default: return <p key={k}>{inline(b.text, k)}</p>;
    }
  });
}
