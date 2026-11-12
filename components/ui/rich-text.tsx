import { Fragment, type ReactNode } from "react";

// A small, safe Markdown subset for chat answers: paragraphs, "-"/"1." lists, **bold**, *italic*, `code`.
// It builds React elements (never raw HTML), so model output cannot inject markup or scripts.

const inlinePattern =
  /(\*\*(?!\s)(?:[^*\n]|\*(?!\*))+?\*\*|__[^_\n]+?__|`[^`\n]+`|(?<![A-Za-z0-9*])\*(?![\s*])[^*\n]+?\*(?![A-Za-z0-9])|(?<![A-Za-z0-9])_(?!\s)[^_\n]+?_(?![A-Za-z0-9])|~~[^~\n]+~~|\[[^\]\n]+\]\([^)\s]+\))/g;

function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const id = key + "-" + at;
    if (token.startsWith("**") || token.startsWith("__"))
      out.push(<strong key={id}>{inline(token.slice(2, -2), id)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={id}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("~~")) out.push(<Fragment key={id}>{token.slice(2, -2)}</Fragment>);
    else if (token.startsWith("[")) out.push(<Fragment key={id}>{token.slice(1, token.indexOf("]"))}</Fragment>);
    else out.push(<em key={id}>{inline(token.slice(1, -1), id)}</em>);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

export function RichText({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const previous = blocks[blocks.length - 1];
    if (!line || /^([-*_])\1{2,}$/.test(line) || /^```/.test(line)) {
      if (previous) blocks.push({ kind: "p", lines: [] });
    } else if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (previous?.kind === kind) previous.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else {
      // Headings are shown as bold lines; the chat bubble is too small for real headings.
      const content = heading ? "**" + heading[1].replace(/\*\*/g, "") + "**" : line;
      if (previous?.kind === "p" && previous.lines.length) previous.lines.push(content);
      else if (previous?.kind === "p") previous.lines = [content];
      else blocks.push({ kind: "p", lines: [content] });
    }
  }
  return (
    <>
      {blocks.map((block, index) => {
        const key = "b" + index;
        if (block.kind === "p")
          return block.lines.length ? (
            <p key={key}>
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  {inline(line, key + "-" + lineIndex)}
                </Fragment>
              ))}
            </p>
          ) : null;
        const List = block.kind;
        return (
          <List key={key}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inline(item, key + "-" + itemIndex)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
