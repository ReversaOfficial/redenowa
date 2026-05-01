import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

/**
 * Renders text with @mentions as clickable links to /u/:handle
 */
export function MentionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const mentionRegex = /@([a-z0-9_]{2,20})/gi;
  const parts: Array<{ type: "text"; value: string } | { type: "mention"; handle: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", handle: match[1].toLowerCase() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <Link
            key={i}
            to="/u/$handle"
            params={{ handle: p.handle }}
            className="font-semibold text-primary hover:underline"
          >
            @{p.handle}
          </Link>
        ) : (
          <Fragment key={i}>{p.value}</Fragment>
        )
      )}
    </span>
  );
}
