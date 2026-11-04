import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function GET() {
  const config = env as unknown as { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET?: string; OPENAI_API_KEY?: string };
  return Response.json({ siteKey: config.TURNSTILE_SITE_KEY ?? null, publicReady: Boolean(config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET && config.OPENAI_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
