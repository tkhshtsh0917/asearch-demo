export interface Question {
  key: number;
  text: string;
  passageId: number;
  title: string;
  url: string;
}

/** Physical row identity is stable within the pinned shard, unlike passage_id
 * (many generated questions refer to the same Wikipedia article). */
export function questionsFromRows(
  rows: Record<string, unknown>[],
  rowStart: number,
): Question[] {
  if (
    !Number.isSafeInteger(rowStart) ||
    rowStart < 0 ||
    rowStart > 0xffffffff ||
    (rows.length > 0 && rowStart + rows.length - 1 > 0xffffffff)
  ) {
    throw new Error("Question row IDs must fit u32");
  }
  return rows.map((row, index) => {
    const passageId =
      typeof row.passage_id === "bigint"
        ? Number(row.passage_id)
        : row.passage_id;
    if (
      typeof passageId !== "number" ||
      !Number.isSafeInteger(passageId) ||
      passageId < 0 ||
      typeof row.query !== "string" ||
      row.query.trim().length === 0 ||
      row.query.length > 65535 ||
      typeof row.title !== "string" ||
      typeof row.url !== "string"
    ) {
      throw new Error(`Invalid question at row ${rowStart + index}`);
    }
    const url = new URL(row.url);
    if (
      url.origin !== "https://ja.wikipedia.org" ||
      !url.pathname.startsWith("/wiki/") ||
      url.username ||
      url.password
    ) {
      throw new Error(`Invalid source URL at row ${rowStart + index}`);
    }
    return {
      key: rowStart + index,
      text: row.query,
      passageId,
      title: row.title,
      url: url.href,
    };
  });
}

export function serializeQuestions(questions: Question[]): string {
  return `${questions.map((question) => JSON.stringify(question)).join("\n")}\n`;
}
