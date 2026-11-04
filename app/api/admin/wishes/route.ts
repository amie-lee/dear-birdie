import { env } from "cloudflare:workers";

export const runtime = "edge";

const config = env as unknown as { DB: D1Database; ADMIN_TOKEN?: string };
const authorize = (request: Request) => Boolean(config.ADMIN_TOKEN && request.headers.get("Authorization") === `Bearer ${config.ADMIN_TOKEN}`);

export async function GET(request: Request) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await config.DB.prepare("SELECT id, body, status, created_at, reports FROM wishes WHERE status IN ('held', 'hidden') ORDER BY created_at ASC LIMIT 100").all();
  return Response.json({ wishes: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let input: { id?: string; status?: string };
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!input.id || !["approved", "rejected", "hidden"].includes(input.status ?? "")) return Response.json({ error: "Invalid decision" }, { status: 400 });
  const result = await config.DB.prepare("UPDATE wishes SET status = ? WHERE id = ? AND status IN ('held', 'hidden', 'approved')").bind(input.status, input.id).run();
  if (!result.meta.changes) return Response.json({ error: "Letter not found" }, { status: 404 });
  return Response.json({ ok: true });
}
