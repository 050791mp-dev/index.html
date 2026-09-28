import type { Context, Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";

const store = (name: string) =>
  Netlify.context?.deploy?.context === "production" ? getStore(name) : getDeployStore(name);

const MODS = ["agenda", "enfoque", "cursos", "clases", "practicar", "plan", "ia", "memoria"];
const txt = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

const leer = async () =>
  ((await store("config").get("app", { type: "json" })) as any) || { nombre: "", anuncio: "", ocultos: [], bloqueados: [] };

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    // Público: la app pide su configuración. Nunca devuelve la lista de bloqueados, solo si ESTE usuario lo está.
    const c = await leer();
    const u = new URL(req.url).searchParams.get("u");
    return Response.json(
      { nombre: c.nombre || "", anuncio: c.anuncio || "", ocultos: c.ocultos || [], bloqueado: !!u && (c.bloqueados || []).includes(u) },
      { headers: { "cache-control": "no-store" } },
    );
  }
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const pass = Netlify.env.get("ADMIN_PASSWORD");
  if (!pass || req.headers.get("x-admin-pass") !== pass) return new Response("No autorizado", { status: 401 });

  let b: any;
  try { b = JSON.parse((await req.text()).slice(0, 20000)); } catch { return new Response("JSON inválido", { status: 400 }); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return new Response("JSON inválido", { status: 400 });
  const prev = await leer();
  const next = {
    nombre: b.nombre !== undefined ? txt(b.nombre, 60) : prev.nombre || "",
    anuncio: b.anuncio !== undefined ? txt(b.anuncio, 280) : prev.anuncio || "",
    ocultos: Array.isArray(b.ocultos) ? b.ocultos.filter((m: unknown) => MODS.includes(m as string)) : prev.ocultos || [],
    bloqueados: Array.isArray(b.bloqueados)
      ? [...new Set(b.bloqueados.map((u: unknown) => txt(u, 40)).filter(Boolean))].slice(0, 500)
      : prev.bloqueados || [],
  };
  await store("config").setJSON("app", next);
  return Response.json(next);
};

export const config: Config = { path: "/api/config" };
