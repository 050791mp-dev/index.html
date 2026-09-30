import type { Context, Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";
import { autorizar, intentosFallidos } from "../lib/auth.mts";

const store = (name: string) =>
  Netlify.context?.deploy?.context === "production" ? getStore(name) : getDeployStore(name);

export default async (req: Request, context: Context) => {
  const rechazo = await autorizar(req, context);
  if (rechazo) return rechazo;

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("dias") || "7", 10) || 7, 1), 60);

  const users = store("usuarios");
  const { blobs: ub } = await users.list();
  const usuarios = await Promise.all(ub.map(async (b) => ({ usuario: b.key, ...(await users.get(b.key, { type: "json" })) })));

  const act = store("actividad");
  const eventos: any[] = [];
  for (let i = 0; i < days && eventos.length < 3000; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const { blobs } = await act.list({ prefix: d + "/" });
    const lotes = await Promise.all(blobs.slice(-400).map((b) => act.get(b.key, { type: "json" })));
    lotes.forEach((l) => Array.isArray(l) && eventos.push(...l));
  }
  eventos.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const cfg = (await store("config").get("app", { type: "json" })) || { nombre: "", anuncio: "", ocultos: [], bloqueados: [] };
  return Response.json(
    { usuarios, eventos: eventos.slice(0, 3000), config: cfg, intentos: await intentosFallidos() },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config: Config = { path: "/api/admin" };
