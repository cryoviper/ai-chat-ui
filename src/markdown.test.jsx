import { describe, it, expect } from "vitest";
import { parseBlocks, inline } from "./markdown.jsx";

describe("parseBlocks", () => {
  it("splits code fences, lists and paragraphs", () => {
    const md = "Hello there\n\n```js\nconst a = 1;\n```\n- one\n- two\n1. first\n2. second";
    const types = parseBlocks(md).map((b) => b.type);
    expect(types).toEqual(["p", "code", "ul", "ol"]);
  });
  it("keeps code content exactly", () => {
    const [b] = parseBlocks("```py\nprint('<b>hi</b>')\n```");
    expect(b).toEqual({ type: "code", lang: "py", text: "print('<b>hi</b>')" });
  });
  it("handles an unclosed fence while streaming", () => {
    const [b] = parseBlocks("```\npartial code");
    expect(b.type).toBe("code");
    expect(b.text).toBe("partial code");
  });
});

describe("inline", () => {
  it("never turns javascript: links into anchors", () => {
    const out = inline("[click](javascript:alert(1))");
    expect(out.some((x) => typeof x === "object" && x?.type === "a")).toBe(false);
  });
  it("renders safe links", () => {
    const out = inline("see [docs](https://react.dev)");
    const a = out.find((x) => x?.type === "a");
    expect(a.props.href).toBe("https://react.dev");
  });
  it("treats HTML as plain text", () => {
    expect(inline("<img src=x onerror=alert(1)>")).toEqual(["<img src=x onerror=alert(1)>"]);
  });
});
