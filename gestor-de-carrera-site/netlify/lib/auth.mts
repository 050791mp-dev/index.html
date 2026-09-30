import type { Context } from "@netlify/functions";
import { createHash, timingSafeEqual } from "node:crypto";
import { getStore, getDeployStore } from "@netlify/blobs";

// Huella SHA-256 de la clave de administradora (la clave en sí no está en el repositorio).
// Si en Netlify existe la variable ADMIN_PASSWORD, esa manda.
const HUELLA = "86c094a90a1c54cc0b7e3ba0b707a7e0e846f9d1486a74d9bf2f4a4a184e9cce";

const MAX_FALLOS = 5, VENTANA = 15 * 60 * 1000;

const sha = (s: string) => createHash("sha256").update(s).digest();
const store = (name: string) =>
  Netlify.context?.deploy?.context === "production" ? getStore(name) : getDeployStore(name);

export const esAdmin = (req: Request) => {
  const dada = (req.headers.get("x-admin-pass") || "").trim();
  if (!dada) return false;
  const env = Netlify.env.get("ADMIN_PASSWORD");
  const esperada = env ? sha(env) : Buffer.from(HUELLA, "hex");
  return timingSafeEqual(sha(dada), esperada);
};

// Devuelve una respuesta de rechazo, o null si la administradora está autorizada.
// Bloquea una IP por 15 minutos después de 5 claves incorrectas y guarda cada intento fallido.
export const autorizar = async (req: Request, context: Context): Promise<Response | null> => {
  const ip = context.ip || "desconocida";
  const clave = sha(ip).toString("hex").slice(0, 32);
  const accesos = store("accesos");
  const ahora = Date.now();
  const previos = (((await accesos.get(clave, { type: "json" })) as number[] | null) || []).filter((t) => ahora - t < VENTANA);

  if (previos.length >= MAX_FALLOS)
    return new Response("Demasiados intentos. Espera 15 minutos.", { status: 429, headers: { "retry-after": "900" } });

  if (esAdmin(req)) {
    if (previos.length) await accesos.delete(clave);
    return null;
  }

  await accesos.setJSON(clave, [...previos, ahora]);
  const geo = context.geo || ({} as any);
  await store("intentos").setJSON(`${new Date(ahora).toISOString()}-${clave.slice(0, 8)}`, {
    ts: new Date(ahora).toISOString(),
    ip,
    device: (req.headers.get("user-agent") || "").slice(0, 200),
    city: geo.city || null,
    country: geo.country?.name || null,
  });
  return new Response("No autorizado", { status: 401 });
};

export const intentosFallidos = async (n = 50) => {
  const st = store("intentos");
  const { blobs } = await st.list();
  const ult = blobs.map((b) => b.key).sort().slice(-n).reverse();
  return (await Promise.all(ult.map((k) => st.get(k, { type: "json" })))).filter(Boolean);
};
