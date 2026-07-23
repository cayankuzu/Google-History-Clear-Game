import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApiRequest } from "../server/index.js";

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const rewrittenUrl = new URL(
    request.url ?? "/api/handler",
    `https://${request.headers.host ?? "localhost"}`,
  );
  const originalPath = rewrittenUrl.searchParams.get("path");

  if (originalPath) {
    rewrittenUrl.searchParams.delete("path");
    const search = rewrittenUrl.searchParams.size
      ? `?${rewrittenUrl.searchParams.toString()}`
      : "";
    request.url = `/api/${originalPath}${search}`;
  }

  return handleApiRequest(request, response);
}
