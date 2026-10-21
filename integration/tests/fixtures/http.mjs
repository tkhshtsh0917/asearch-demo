import { invoke } from "./server.mjs";

// Match the CLI JSON input ceiling while keeping loopback requests bounded.
export const MAX_FIXTURE_BYTES = 64 * 1024 * 1024;

/** Handles one fixture request without propagating input or CLI failures. */
export async function serveFixture(req, res, maxBytes = MAX_FIXTURE_BYTES) {
  let status = 400;
  try {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length <= maxBytes) chunks.push(chunk);
      else chunks.length = 0;
    }
    if (length > maxBytes) {
      res.writeHead(413).end();
      return;
    }
    const { command, input } = JSON.parse(
      Buffer.concat(chunks).toString("utf8"),
    );
    if (!["build-flat", "compact"].includes(command)) {
      res.writeHead(400).end();
      return;
    }
    status = 422;
    const bytes = invoke(command, input);
    res
      .writeHead(200, { "Content-Type": "application/octet-stream" })
      .end(bytes);
  } catch {
    if (!res.destroyed && !res.headersSent) {
      res.writeHead(status, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          error:
            status === 400
              ? "Invalid fixture request"
              : "Fixture generation failed",
        }),
      );
    }
  }
}
