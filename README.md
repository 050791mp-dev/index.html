# Lima Local Experience

Sitio de Johnny Morant: traslados privados, tours y experiencias locales en Lima, Callao y provincias. Las reservas se envían por WhatsApp (+51 902 703 296).

## Estructura
- `index.html`: página completa (HTML + CSS + JS, sin dependencias).
- `assets/img/`: imágenes optimizadas en WebP.

## Editar servicios y precios
Todos los servicios están en el arreglo `S` dentro del `<script>` de `index.html`. Desde ahí se generan las tarjetas, los filtros y el formulario de reserva. Cambia título, descripción, precio (`p`) o unidad (`u`) en un solo lugar.

## Publicar
Es un sitio estático: sirve con GitHub Pages, Netlify o cualquier hosting. Sube `index.html` y la carpeta `assets/`.
