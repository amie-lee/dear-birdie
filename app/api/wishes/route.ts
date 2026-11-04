import { env } from "cloudflare:workers";

export const runtime = "edge";

const config = env as unknown as { DB: D1Database; OPENAI_API_KEY?: string; TURNSTILE_SECRET?: string; TURNSTILE_SITE_KEY?: string };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, "0")).join("");

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get("cursor");
  let before: number | null = null;
  let beforeId = "";
  if (cursor) {
    const match = /^(\d{1,16}):([a-zA-Z0-9-]{1,100})$/.exec(cursor);
    if (!match || !Number.isSafeInteger(Number(match[1]))) return json({ error: "Invalid page." }, 400);
    before = Number(match[1]);
    beforeId = match[2];
  }
  const query = before === null
    ? config.DB.prepare("SELECT id, body, created_at AS createdAt FROM wishes WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 25")
    : config.DB.prepare("SELECT id, body, created_at AS createdAt FROM wishes WHERE status = 'approved' AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 25").bind(before, before, beforeId);
  const rows = await query.all<{ id: string; body: string; createdAt: number }>();
  const letters = rows.results.slice(0, 24);
  const last = letters.at(-1);
  return json({ letter: letters[0] ?? null, letters, nextCursor: rows.results.length > 24 && last ? `${last.createdAt}:${last.id}` : null });
}

export async function POST(request: Request) {
  if (Number(request.headers.get("Content-Length") ?? 0) > 8192) return json({ error: "This letter is too long." }, 413);
  let payload: { body?: unknown; token?: unknown; turnstile?: unknown };
  try { payload = await request.json(); } catch { return json({ error: "We could not read your letter." }, 400); }
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (body.length < 10 || body.length > 500) return json({ error: "Write your wish in 10–500 characters." }, 400);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body) || /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{8,}\d)/i.test(body)) return json({ error: "Remove links and contact details before sending." }, 400);
  const deleteToken = typeof payload.token === "string" && payload.token.length >= 24 && payload.token.length <= 100 ? payload.token : "";
  if (!deleteToken) return json({ error: "Please try again." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const rateKey = await digest(`${config.TURNSTILE_SECRET ?? "private-preview"}:${day}:${ip}`);
  await config.DB.prepare("INSERT INTO daily_limits (key, count) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1").bind(rateKey).run();
  const counter = await config.DB.prepare("SELECT count FROM daily_limits WHERE key = ?").bind(rateKey).first<{ count: number }>();
  if ((counter?.count ?? 0) > 5) return json({ error: "You have sent all five shared letters for today." }, 429);

  let verified = false;
  if (config.TURNSTILE_SECRET) {
    if (typeof payload.turnstile !== "string" || !payload.turnstile) return json({ error: "Complete the verification before sending." }, 400);
    const form = new FormData();
    form.set("secret", config.TURNSTILE_SECRET);
    form.set("response", payload.turnstile);
    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
      verified = Boolean((await response.json() as { success?: boolean }).success);
    } catch { verified = false; }
    if (!verified) return json({ error: "Verification failed. Please try again shortly." }, 400);
  }

  let status = "held";
  if (verified && config.OPENAI_API_KEY && config.TURNSTILE_SITE_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        signal: AbortSignal.timeout(10000),
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: "omni-moderation-latest", input: body }),
      });
      if (response.ok) {
        const result = await response.json() as { results?: Array<{ flagged?: boolean }> };
        status = result.results?.[0]?.flagged === false ? "approved" : "held";
      }
    } catch { status = "held"; }
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  await config.DB.prepare("INSERT INTO wishes (id, body, status, created_at, available_at, cheers, reports, delete_hash) VALUES (?, ?, ?, ?, ?, 0, 0, ?)")
    .bind(id, body, status, now, now, await digest(deleteToken)).run();
  return json({ id, status, availableAt: now }, 201);
}
