"use client";

import Link from "next/link";

// عارض نص بسيط وآمن لردود المساعد: يدعم **عريض** وروابط [نص](رابط) والقوائم "- ".
// لا يستخدم dangerouslySetInnerHTML، وأي رابط غير "/..." أو "https://..." يُعرض كنص عادي.
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text, keyPrefix) {
  return text.split(TOKEN).map((part, i) => {
    const key = keyPrefix + "-" + i;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <b key={key}>{part.slice(2, -2)}</b>;
    }
    const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (m) {
      const [, label, href] = m;
      if (href.startsWith("/") && !href.startsWith("//")) {
        return <Link key={key} href={href}>{label}</Link>;
      }
      if (/^https:\/\//i.test(href)) {
        return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
      }
      return label;
    }
    return part;
  });
}

export default function RichText({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        const li = line.match(/^\s*[-•]\s+(.*)$/);
        if (li) return <div className="rt-li" key={i}>• {inline(li[1], "l" + i)}</div>;
        return <div key={i}>{inline(line, "p" + i)}</div>;
      })}
    </>
  );
}
