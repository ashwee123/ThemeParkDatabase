import { handleRequest } from "../request-handler.js";

export default async function handler(req, res) {
  await handleRequest(req, res, { vercel: true });
}
