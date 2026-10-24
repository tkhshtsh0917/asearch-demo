/** Renders safe result text and highlight ranges without interpreting content as HTML. */
import { sourceUrl } from "../shared/catalog.ts";
import type { Row } from "../shared/protocol.ts";

/** Applies ranges only to the exact source text described by an explanation. */
function highlightedText(
  value: string,
  spans: [number, number][],
  className: string,
) {
  const text = document.createElement("p");
  text.className = className;
  let cursor = 0;
  for (const [start, end] of spans) {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < cursor ||
      end <= start ||
      end > value.length
    )
      continue;
    text.append(document.createTextNode(value.slice(cursor, start)));
    const mark = document.createElement("mark");
    mark.textContent = value.slice(start, end);
    text.append(mark);
    cursor = end;
  }
  text.append(document.createTextNode(value.slice(cursor)));
  return text;
}

/** Keeps original questions visible and labels matches through auxiliary texts. */
export function renderRows(target: HTMLElement, rows: Row[]): void {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const item = document.createElement("li"),
      article = document.createElement("article"),
      text = highlightedText(row.text, row.spans, "question");
    const meta = document.createElement("div");
    meta.className = "result-meta";
    const label = document.createElement("span");
    label.textContent = `距離 ${row.level} · ${row.title}`;
    meta.append(label);
    if (row.url) {
      const link = document.createElement("a");
      link.href = sourceUrl(row.url);
      link.textContent = "Wikipedia ↗";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      meta.append(link);
    }
    article.append(text);
    if (row.change) {
      item.dataset.change = row.change;
      const badge = document.createElement("span");
      badge.className = "change-badge";
      badge.textContent =
        row.change === "added" ? "追加された質問" : "変更された質問";
      article.prepend(badge);
    }
    if (row.alias) {
      const alias = highlightedText(
        row.alias.text,
        row.alias.spans,
        "search-alias",
      );
      alias.prepend(document.createTextNode("検索用表現: "));
      article.append(alias);
    }
    article.append(meta);
    item.append(article);
    fragment.append(item);
  }
  target.replaceChildren(fragment);
}
