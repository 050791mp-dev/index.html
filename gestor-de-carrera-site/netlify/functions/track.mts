import type { Context, Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";

const store = (name: string) =>
  Netlify.context?.deploy?.context === "production" ? getStore(name) : getDeployStore(name);

const clip = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : v == null ? null : String(v).slice(0, n));

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const raw = await req.text();
  if (raw.length > 40000) return new Response("Demasiado grande", { status: 413 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response("JSON inválido", { status: 400 }); }
  const events = Array.isArray(body?.events) ? body.events.slice(0, 60) : [];
  if (!events.length) return new Response(null, { status: 204 });

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const geo = context.geo || ({} as any);
  const base = {
    sid: clip(body.sid, 40),
    user: clip(body.user, 40),
    device: clip(body.device, 200),
    lang: clip(body.lang, 20),
    screen: clip(body.screen, 20),
    tz: clip(body.tz, 40),
    country: clip(geo.country?.name, 60),
    city: clip(geo.city, 60),
    ip: clip(context.ip, 60),
  };
  const act = store("actividad");
  const rows = events.map((e: any) => ({
    ...base,
    ts: typeof e.ts === "number" ? new Date(e.ts).toISOString() : now.toISOString(),
    type: clip(e.type, 30),
    target: clip(e.target, 80),
    section: clip(e.section, 30),
    value: typeof e.value === "number" ? e.value : null,
  }));
  const key = `${day}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  await act.setJSON(key, rows);

  if (base.user) {
    const users = store("usuarios");
    const prev = (await users.get(base.user, { type: "json" })) || { primera: now.toISOString(), eventos: 0 };
    await users.setJSON(base.user, {
      ...prev,
      ultima: now.toISOString(),
      eventos: (prev.eventos || 0) + rows.length,
      device: base.device,
      country: base.country,
      city: base.city,
    });
  }
  return new Response(null, { status: 204 });
};

export const config: Config = { path: "/api/track" };
