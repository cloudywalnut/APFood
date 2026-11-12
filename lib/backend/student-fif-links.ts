// Student FIF chat: turns links in an answer into buttons, limited to student pages.
export type StudentChatLink = { href: string; label: string };

// Only student pages in the app can become buttons.
const allowed =
  /^(?:\/app(?:\/(?:orders|cart|vendors|map|traffic)(?:\/[A-Za-z0-9-]{1,96}){0,3})?|\/account|\/privacy|\/terms)$/;
const markdownLink = /\[([^\]\n]{1,60})\]\((\/[A-Za-z][^)\s]*)\)/g;
// The lookahead stops partial matches such as "/app" in "/app/../admin".
const barePath =
  /(?:\s+(?:at|here|via|on|from))?\s*:?\s*[`(]?(\/app(?:\/[A-Za-z0-9-]+)*|\/account|\/privacy|\/terms)(?![A-Za-z0-9/-]|\.[A-Za-z0-9./])[`)]?/g;

function fallbackLabel(href: string) {
  const parts = href.split("/").filter(Boolean);
  if (parts[1] === "orders") return parts[2] ? "Open order " + parts[2].slice(0, 8) : "My orders";
  if (parts[1] === "cart") return "View cart";
  if (parts[1] === "vendors") return parts[3] === "item" ? "View item" : parts[2] ? "View stall" : "Browse stalls";
  if (parts[1] === "map") return "Open map";
  if (parts[1] === "traffic") return "Current traffic";
  if (parts[0] === "account") return "Account settings";
  if (parts[0] === "privacy") return "Privacy";
  if (parts[0] === "terms") return "Terms";
  return "Open AP Food";
}

// Pulls app paths out of a model reply so the chat can show them as buttons instead of raw URLs.
export function extractStudentLinks(reply: string) {
  const links: StudentChatLink[] = [];
  const add = (href: string, label?: string) => {
    const clean = href.replace(/[.,;:!?]+$/, "");
    if (!allowed.test(clean) || links.some((link) => link.href === clean) || links.length >= 4) return;
    links.push({ href: clean, label: (label?.trim() || fallbackLabel(clean)).slice(0, 40) });
  };
  // Removed links leave a marker so only the words right before them are tidied, never the rest of the text.
  const gap = "\u0000";
  let droppedUntil = -1;
  let text = reply.replace(markdownLink, (match, label: string, href: string, at: number, whole: string) => {
    const clean = href.replace(/[.,;:!?]+$/, "");
    if (!allowed.test(clean)) return label;
    add(clean, label);
    // The button already shows the label, so drop it when it is a call to action ("Open order"),
    // was introduced like a link ("check them here: My orders"), or follows a dropped link ("A · B").
    const before = whole.slice(Math.max(0, at - 12), at);
    const introduced = /(?::|\bhere|\bat|\bin|[—–])\s*$/i.test(before);
    const listed = droppedUntil >= 0 && /^[\s·|,/]*(?:and|or)?[\s·|,/]*$/i.test(whole.slice(droppedUntil, at));
    if (!/^(?:open|view|see|go to|browse|track|check)\b/i.test(label.trim()) && !introduced && !listed) return label;
    droppedUntil = at + match.length;
    return gap;
  });
  text = text.replace(barePath, (match, href: string) => {
    if (!allowed.test(href.replace(/[.,;:!?]+$/, ""))) return match;
    add(href);
    return gap;
  });
  text = text
    // Separators between removed links ("A · B", "A, B or C") go with them.
    .replace(/\u0000(?:[ \t]*(?:[·|,/]|\band\b|\bor\b)?[ \t]*\u0000)+/gi, gap)
    // "…order page: [link]", "…here [link]", "…in [link]" or "… — [link]" lose their lead-in words.
    .replace(/[ \t]*(?:[—–]|,)?[ \t]*(?:\b(?:here|in|at|from|on|via)\b[ \t]*)?:?[ \t]*\u0000/gi, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/:([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: text || reply.trim(), links };
}
