# Respaldo de Kontea (inventario)

Aquí queda guardada, sin cambios, la app de inventario de Kontea que estaba publicada
hasta el 10 de noviembre de 2026. Se sacó temporalmente para publicar la app de pedidos
en kontea.divende.com.

GitHub Pages no publica las carpetas que empiezan con guion bajo, así que este respaldo
no queda visible en el sitio.

Para restaurarla:

    git mv _respaldo-kontea/index.html index.html
    cp _respaldo-kontea/manifest.json _respaldo-kontea/sw.js .

y suba un número nuevo en `CACHE_NAME` dentro de `sw.js` para que los teléfonos
descarguen la versión restaurada.
