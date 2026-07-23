import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApiRequest } from "../server/index.ts";

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  return handleApiRequest(request, response);
}
