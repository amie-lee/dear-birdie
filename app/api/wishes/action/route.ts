import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function POST(request: Request) {
  let payload: { id?: string; action?: string; token?: string };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const db = env.DB;
  if (!db) return Response.json({ error: "The letter archive is unavailable." }, { status: 503 });
  if (!payload.id || typeof payload.id !== "string") return Response.json({ error: "Letter not found." }, { status: 400 });
  if (payload.action === "report") {
    await db.prepare("UPDATE wishes SET status = 'hidden', reports = reports + 1 WHERE id = ? AND status = 'approved'").bind(payload.id).run();
    return Response.json({ ok: true });
  }
  if (payload.action === "cheer") {
    await db.prepare("UPDATE wishes SET cheers = cheers + 1 WHERE id = ? AND status = 'approved'").bind(payload.id).run();
    return Response.json({ ok: true });
  }
  if (payload.action === "delete" && typeof payload.token === "string") {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload.token)))).map(n => n.toString(16).padStart(2, "0")).join("");
    const result = await db.prepare("UPDATE wishes SET status = 'deleted', body = '' WHERE id = ? AND delete_hash = ?").bind(payload.id, hash).run();
    if (!result.meta.changes) return Response.json({ error: "This letter could not be withdrawn." }, { status: 404 });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported action." }, { status: 400 });
}
