/** Renders safe result text and highlight ranges without interpreting content as HTML. */
import { sourceUrl } from "../shared/catalog.ts";
import type { Row } from "../shared/protocol.ts";

export function renderRows(target: HTMLElement, rows: Row[]): void {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const item = document.createElement("li"),
      article = document.createElement("article"),
      text = document.createElement("p");
    text.className = "question";
    let cursor = 0;
    for (const [start, end] of row.spans) {
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < cursor ||
        end <= start ||
        end > row.text.length
      )
        continue;
      text.append(document.createTextNode(row.text.slice(cursor, start)));
      const mark = document.createElement("mark");
      mark.textContent = row.text.slice(start, end);
      text.append(mark);
      cursor = end;
    }
    text.append(document.createTextNode(row.text.slice(cursor)));
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
    article.append(text, meta);
    item.append(article);
    fragment.append(item);
  }
  target.replaceChildren(fragment);
}
