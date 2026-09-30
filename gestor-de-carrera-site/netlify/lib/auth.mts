import { createHash, timingSafeEqual } from "node:crypto";

// Huella SHA-256 de la clave de administradora (la clave en sí no está en el repositorio).
// Si en Netlify existe la variable ADMIN_PASSWORD, esa manda.
const HUELLA = "86c094a90a1c54cc0b7e3ba0b707a7e0e846f9d1486a74d9bf2f4a4a184e9cce";

const sha = (s: string) => createHash("sha256").update(s).digest();

export const esAdmin = (req: Request) => {
  const dada = (req.headers.get("x-admin-pass") || "").trim();
  if (!dada) return false;
  const env = Netlify.env.get("ADMIN_PASSWORD");
  const esperada = env ? sha(env) : Buffer.from(HUELLA, "hex");
  return timingSafeEqual(sha(dada), esperada);
};
