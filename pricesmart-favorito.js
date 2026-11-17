/* Kontea · favorito para PriceSmart (v2)
   Se ejecuta en www.pricesmart.com con la sesión del usuario abierta.
   Lee el pedido del enlace: #kontea=SKU[~SUSTITUTO]xCANT,…&faltan=Nombre|Nombre&vuelta=https://kontea.divende.com/
   Abre cada ficha en un marco oculto, pone la cantidad y toca «Agregar a carrito».
   Si no hay: prueba el sustituto guardado; si tampoco, anota en qué clubes hay y busca parecidos.
   Al final ofrece «Volver a Kontea» con lo que faltó (solo números de artículo, nombres y precios).
   No guarda ni envía datos a ningún otro sitio. */
(async () => {
  if (window.__konteaCorriendo) return;
  window.__konteaCorriendo = true;
  const VERSION = '2';
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const crudo = params.get('kontea') || '';
  const faltan = (params.get('faltan') || '').split('|').map(s => s.trim()).filter(Boolean);
  /* Solo se vuelve a un sitio de Divende */
  let vuelta = 'https://kontea.divende.com/';
  try { const v = new URL(params.get('vuelta') || ''); if (v.protocol === 'https:' && /(^|\.)divende\.com$/.test(v.hostname)) vuelta = v.origin + v.pathname; } catch (e) { /* se usa la de siempre */ }

  /* Panel */
  const panel = document.createElement('div');
  panel.setAttribute('role', 'status');
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;max-width:calc(100vw - 32px);max-height:75vh;overflow:auto;background:#fff;color:#1A1D1B;border:1px solid #E3E1D9;border-radius:14px;padding:16px;font:14px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)';
  document.body.appendChild(panel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const btn = (id, txt, prim) => '<button type="button" id="' + id + '" style="margin-top:10px;width:100%;min-height:42px;border:' + (prim ? '0' : '1px solid #C9C6BC') + ';border-radius:10px;background:' + (prim ? '#1F4F8A' : '#fff') + ';color:' + (prim ? '#fff' : '#1A1D1B') + ';font:inherit;font-weight:600">' + txt + '</button>';
  const pintar = (titulo, cuerpo, botones) => {
    panel.innerHTML = '<div style="font-weight:600;font-size:15px;margin-bottom:6px">' + esc(titulo) + '</div>' + cuerpo + (botones || '');
  };
  const cerrar = () => { panel.remove(); window.__konteaCorriendo = false; };
  const alCarrito = () => { cerrar(); if (location.pathname.indexOf('/carrito') < 0) location.href = '/es-cr/carrito'; else location.reload(); };

  if (!/pricesmart\.com$/.test(location.hostname)) {
    pintar('Kontea', '<p style="margin:0">Este botón funciona solo en pricesmart.com. Abra el pedido desde Kontea con «Pasar a PriceSmart».</p>', btn('k-ok', 'Listo', true));
    panel.querySelector('#k-ok').onclick = cerrar;
    return;
  }
  const lista = crudo.split(',').map(x => {
    const m = x.trim().match(/^(\d{2,8})(?:~(\d{2,8}))?x(\d+(?:\.\d+)?)$/);
    return m ? { sku: m[1], alt: m[2] || '', cant: Math.max(1, Math.round(+m[3])) } : null;
  }).filter(Boolean);
  if (!lista.length) {
    pintar('Kontea', '<p style="margin:0">No hay pedido en esta página. En Kontea, abra el pedido de PriceSmart y toque «Pasar a PriceSmart»; después toque este favorito.</p>', btn('k-ok', 'Listo', true));
    panel.querySelector('#k-ok').onclick = cerrar;
    return;
  }

  const entregaTxt = ((document.querySelector('header') || document.body).innerText || '').match(/Recoger en club\s*\n?\s*([^\n]+)/i);
  const club = entregaTxt ? entregaTxt[1].trim() : '';
  const aviso = club ? '<div style="background:#FBEBDC;color:#6E370C;border-radius:8px;padding:8px;margin-top:8px;font-size:12px">La entrega está en «Recoger en club ' + esc(club) + '». Si el pedido es a domicilio, cámbiela arriba antes de usar este botón: lo disponible cambia según la entrega.</div>' : '';

  /* Marco oculto donde se abre cada página */
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;left:-3000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(marco);
  const cargar = url => new Promise(res => {
    const t = setTimeout(() => res(false), 30000);
    marco.onload = () => { clearTimeout(t); res(true); };
    marco.src = url;
  });
  const textoDe = d => (d.querySelector('main') || d.body).innerText || '';
  const ocupado = d => [...d.querySelectorAll('div,span,p')].some(e => e.offsetParent && /^\s*Un momento por favor\s*$/.test(e.textContent || ''));
  const enCarrito = d => {
    const c = d.querySelector('[aria-label="cart page"]');
    const m = c && (c.textContent || '').trim().match(/(\d+)\s*$/);
    return m ? +m[1] : 0;
  };
  const precioDe = t => { const m = String(t).match(/₡\s?([\d\s.]+),(\d{2})/); return m ? +(m[1].replace(/[\s.]/g, '') + '.' + m[2]) : null; };

  /* Espera a que la ficha cargue: botón listo y opciones de entrega ya pintadas */
  async function esperarFicha(d, ms) {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const b = d.querySelector('[aria-label="Add_To_Cart"]');
      const texto = textoDe(d);
      if (b && !ocupado(d) && /Opciones de entrega/i.test(texto) && /Disponible/i.test(texto)) {
        const i = texto.search(/Opciones de entrega/i), entrega = texto.slice(i, i + 200);
        if (b.disabled || /No Disponible/i.test(entrega)) return { b: null, sinExistencia: true, motivo: 'no hay para la entrega elegida' };
        return { b };
      }
      if (!b && /página no encontrada|no encontramos/i.test(texto)) return { b: null, motivo: 'el artículo ya no existe' };
      await esperar(400);
    }
    return { b: null, motivo: 'la ficha no cargó a tiempo' };
  }
  /* Clubes donde la ficha marca existencia */
  function clubesCon(d) {
    const h = [...d.querySelectorAll('*')].find(e => e.children.length === 0 && /^\s*Disponibilidad en clubes\s*$/i.test(e.textContent || ''));
    let c = h;
    for (let i = 0; i < 4 && c; i++) { c = c.parentElement; if (c && c.querySelectorAll('img').length >= 3) break; }
    if (!c) return [];
    const out = [];
    for (const e of c.querySelectorAll('*')) {
      if (e.children.length || e.tagName === 'IMG') continue;
      const t = (e.textContent || '').trim();
      if (!t || t.length > 30 || /Disponibilidad/i.test(t)) continue;
      const img = e.parentElement && e.parentElement.querySelector('img');
      if (img && /available-icon|Icon Available/i.test((img.getAttribute('src') || '') + ' ' + (img.alt || '')) && !/not-available|Disable/i.test((img.getAttribute('src') || '') + ' ' + (img.alt || ''))) out.push(t);
    }
    return out;
  }
  /* Agrega la ficha cargada con la cantidad pedida; confirma con el contador del carrito */
  async function agregar(d, boton, cant) {
    const antes = enCarrito(d);
    const campo = d.querySelector('.sf-quantity-selector input, input[aria-label="Quantity Selector"]');
    const mas = d.querySelector('[data-testid="increase"]');
    for (let k = 1; k < cant && mas; k++) { mas.click(); await esperar(120); }
    await esperar(300);
    if (campo && +campo.value !== cant) return 'no se pudo poner la cantidad';
    boton.click();
    const fin = Date.now() + 20000;
    while (enCarrito(d) < antes + cant && Date.now() < fin) await esperar(300);
    return enCarrito(d) >= antes + cant ? '' : 'PriceSmart no confirmó que se agregó';
  }
  /* Palabras clave del nombre, sin marca, tamaños ni relleno */
  const VACIAS = new Set(['members', 'member', 's', 'selection', 'de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'en', 'para', 'por', 'unidades', 'unidad', 'x', 'g', 'kg', 'oz', 'lb', 'ml', 'l', 'lt', 'gal', 'cm', 'm']);
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fichas = s => norm(s).split(/[^a-z0-9.]+/).filter(w => w && !VACIAS.has(w) && !/^\d$/.test(w));
  const claves = s => fichas(s).filter(w => !/^\d/.test(w)).slice(0, 3);
  /* Busca parecidos disponibles y los ordena por parecido y precio */
  async function parecidos(nombre, sku, precio) {
    const q = claves(nombre).slice(0, 2).join(' ');
    if (!q) return [];
    await cargar('/es-cr/busqueda?q=' + encodeURIComponent(q));
    const d = marco.contentDocument, fin = Date.now() + 15000;
    while (Date.now() < fin && !d.querySelector('a[href*="/producto/"]') && !/no (se )?encontr/i.test(textoDe(d))) await esperar(400);
    await esperar(800);
    const base = new Set(fichas(nombre)), visto = {}, res = [];
    for (const a of d.querySelectorAll('a[href*="/producto/"]')) {
      const m = (a.getAttribute('href') || '').match(/\/(\d{2,8})\/?$/);
      if (!m || visto[m[1]] || m[1] === sku) continue;
      let c = a;
      for (let i = 0; i < 6 && c && !/₡/.test(c.innerText || ''); i++) c = c.parentElement;
      if (!c) continue;
      const t = c.innerText || '';
      const n = [...c.querySelectorAll('a[href*="/producto/"]')].map(x => x.textContent.trim()).filter(Boolean).sort((x, y) => y.length - x.length)[0];
      if (!n) continue;
      visto[m[1]] = 1;
      if (/No disponible/i.test(t) || !/Disponible/i.test(t)) continue;
      const p = precioDe(t), puntos = fichas(n).filter(w => base.has(w)).length;
      const dif = precio && p ? Math.abs(p - precio) / precio : 1;
      if (puntos >= 2 || (puntos === 1 && dif <= 0.5)) res.push({ s: m[1], n, p, puntos, dif });
    }
    return res.sort((x, y) => y.puntos - x.puntos || x.dif - y.dif).slice(0, 3).map(({ s, n, p }) => ({ s, n, p }));
  }

  const ok = [], mal = [], usados = [], faltantes = [];
  for (let i = 0; i < lista.length; i++) {
    const it = lista[i];
    pintar('Kontea · agregando al carrito', '<div style="height:8px;background:#EEECE6;border-radius:4px;margin:6px 0"><div style="height:8px;width:' + Math.round(i / lista.length * 100) + '%;background:#1F4F8A;border-radius:4px"></div></div>' +
      '<div style="color:#5E6460">' + i + ' de ' + lista.length + ' · artículo ' + esc(it.sku) + '</div><div style="color:#8A8F8B;font-size:12px;margin-top:6px">No cierre esta pestaña.</div>' + aviso);
    try {
      await cargar('/es-cr/producto/p/' + it.sku);
      let d = marco.contentDocument;
      const r = await esperarFicha(d, 25000);
      const nombre = ((d.querySelector('h1') || {}).textContent || '').trim() || ('Artículo ' + it.sku);
      if (r.b) {
        const e = await agregar(d, r.b, it.cant);
        if (e) mal.push({ ...it, nombre, motivo: e }); else ok.push({ ...it, nombre });
        continue;
      }
      if (!r.sinExistencia) { mal.push({ ...it, nombre, motivo: r.motivo }); continue; }
      const precio = precioDe(textoDe(d)), clubes = clubesCon(d);
      /* Sustituto que el restaurante ya eligió antes */
      if (it.alt) {
        await cargar('/es-cr/producto/p/' + it.alt);
        d = marco.contentDocument;
        const r2 = await esperarFicha(d, 25000);
        const nAlt = ((d.querySelector('h1') || {}).textContent || '').trim() || ('Artículo ' + it.alt);
        if (r2.b && !(await agregar(d, r2.b, it.cant))) { usados.push({ ...it, nombre, nAlt }); continue; }
      }
      pintar('Kontea · buscando parecidos', '<div style="color:#5E6460">No hay ' + esc(nombre) + '. Buscando opciones…</div>' + aviso);
      const alts = await parecidos(nombre, it.sku, precio);
      faltantes.push({ s: it.sku, c: it.cant, n: nombre, p: precio, cl: clubes, a: alts });
    } catch (e) {
      mal.push({ ...it, nombre: 'Artículo ' + it.sku, motivo: 'error al abrir la página' });
    }
  }
  marco.remove();

  const fila = t => '<div style="padding:4px 0;border-bottom:1px solid #EEECE6">' + t + '</div>';
  const peso = n => n.replace(/\s*\/.*$/, '');
  let cuerpo = '<div style="color:#5E6460;margin-bottom:8px">' + (ok.length + usados.length) + ' de ' + lista.length + ' agregados. Revise el carrito antes de pagar.</div>';
  if (usados.length) cuerpo += '<div style="font-weight:600;margin-top:8px">Se usó el sustituto</div>' + usados.map(x => fila(esc(x.cant + ' × ' + peso(x.nAlt)) + ' <span style="color:#5E6460">en vez de ' + esc(peso(x.nombre)) + '</span>')).join('');
  if (faltantes.length) cuerpo += '<div style="font-weight:600;margin-top:8px">No hay' + (club ? ' en ' + esc(club) : '') + '</div>' + faltantes.map(x => fila(esc(x.c + ' × ' + peso(x.n)) + (x.cl.length ? '<div style="font-size:12px;color:#5E6460">Hay en: ' + esc(x.cl.join(', ')) + '</div>' : ''))).join('');
  if (mal.length) cuerpo += '<div style="font-weight:600;margin-top:8px">No se agregaron</div>' + mal.map(x => fila(esc(x.cant + ' × ' + peso(x.nombre)) + ' <span style="color:#A23A2A">(' + esc(x.motivo) + ')</span>')).join('');
  if (faltan.length) cuerpo += '<div style="font-weight:600;margin-top:8px">Agregar a mano</div>' + faltan.map(n => fila(esc(n))).join('');
  cuerpo += aviso + '<div style="color:#8A8F8B;font-size:12px;margin-top:8px">Kontea · favorito v' + VERSION + '</div>';
  const pendientes = faltantes.length + mal.length;
  pintar(pendientes || faltan.length ? 'Pedido pasado con pendientes' : 'Pedido pasado al carrito', cuerpo,
    (faltantes.length || mal.length ? btn('k-vuelta', 'Volver a Kontea con lo que faltó', true) + btn('k-ok', 'Ver el carrito') : btn('k-ok', 'Ver el carrito', true)));
  panel.querySelector('#k-ok').onclick = alCarrito;
  const v = panel.querySelector('#k-vuelta');
  if (v) v.onclick = () => {
    const datos = { t: 'PRICESMART', f: faltantes.concat(mal.map(x => ({ s: x.sku, c: x.cant, n: x.nombre, p: null, cl: [], a: [], m: x.motivo }))), u: usados.map(x => ({ s: x.sku, alt: x.alt })), club };
    cerrar();
    location.href = vuelta + '#faltantes=' + encodeURIComponent(JSON.stringify(datos));
  };
})();
