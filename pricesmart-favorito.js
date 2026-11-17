/* Kontea · favorito para PriceSmart
   Se ejecuta en www.pricesmart.com con la sesión del usuario abierta.
   Lee el pedido del enlace (#kontea=SKUxCANT,SKUxCANT…&faltan=Nombre|Nombre),
   abre cada ficha en un marco oculto, pone la cantidad y toca «Agregar a carrito».
   No guarda ni envía datos a ningún otro sitio. */
(async () => {
  if (window.__konteaCorriendo) return;
  window.__konteaCorriendo = true;
  const VERSION = '1';
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const crudo = params.get('kontea') || '';
  const faltan = (params.get('faltan') || '').split('|').map(s => s.trim()).filter(Boolean);

  /* Panel */
  const panel = document.createElement('div');
  panel.setAttribute('role', 'status');
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:320px;max-height:70vh;overflow:auto;background:#fff;color:#1A1D1B;border:1px solid #E3E1D9;border-radius:14px;padding:16px;font:14px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)';
  document.body.appendChild(panel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pintar = (titulo, cuerpo, fin) => {
    panel.innerHTML = '<div style="font-weight:600;font-size:15px;margin-bottom:6px">' + esc(titulo) + '</div>' + cuerpo +
      (fin ? '<button type="button" id="kontea-cerrar" style="margin-top:12px;width:100%;min-height:40px;border:0;border-radius:10px;background:#1F4F8A;color:#fff;font:inherit;font-weight:600">Listo</button>' : '');
    const b = panel.querySelector('#kontea-cerrar');
    if (b) b.onclick = () => { panel.remove(); window.__konteaCorriendo = false; if (location.pathname.indexOf('/carrito') < 0) location.href = '/es-cr/carrito'; else location.reload(); };
  };

  if (!/pricesmart\.com$/.test(location.hostname)) {
    pintar('Kontea', '<p style="margin:0">Este botón funciona solo en pricesmart.com. Abra el pedido desde Kontea con «Pasar a PriceSmart».</p>', true);
    return;
  }
  const lista = crudo.split(',').map(x => {
    const m = x.trim().match(/^(\d{2,8})x(\d+(?:\.\d+)?)$/);
    return m ? { sku: m[1], cant: Math.max(1, Math.round(+m[2])) } : null;
  }).filter(Boolean);
  if (!lista.length) {
    pintar('Kontea', '<p style="margin:0">No hay pedido en esta página. En Kontea, abra el pedido de PriceSmart y toque «Pasar a PriceSmart»; después toque este favorito.</p>', true);
    return;
  }

  const entrega = ((document.querySelector('header') || document.body).innerText || '').match(/Recoger en club\s*\n?\s*([^\n]+)/i);
  const aviso = entrega ? '<div style="background:#FBEBDC;color:#6E370C;border-radius:8px;padding:8px;margin-top:8px;font-size:12px">La entrega está en «Recoger en club ' + esc(entrega[1].trim()) + '». Si el pedido es a domicilio, cámbiela arriba antes de usar este botón: lo disponible cambia según la entrega.</div>' : '';

  /* Marco oculto donde se abre cada ficha de producto */
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;left:-3000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(marco);

  const cargar = url => new Promise(res => {
    const t = setTimeout(() => res(false), 30000);
    marco.onload = () => { clearTimeout(t); res(true); };
    marco.src = url;
  });
  const ocupado = d => [...d.querySelectorAll('div,span,p')].some(e => e.offsetParent && /^\s*Un momento por favor\s*$/.test(e.textContent || ''));
  /* Unidades en el carrito según el contador del encabezado */
  const enCarrito = d => {
    const c = d.querySelector('[aria-label="cart page"]');
    const m = c && (c.textContent || '').trim().match(/(\d+)\s*$/);
    return m ? +m[1] : 0;
  };
  /* Espera a que la ficha cargue: botón listo y opciones de entrega ya pintadas */
  async function esperarFicha(d, ms) {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const b = d.querySelector('[aria-label="Add_To_Cart"]');
      const texto = (d.querySelector('main') || d.body).innerText || '';
      if (b && !ocupado(d) && /Opciones de entrega/i.test(texto) && /Disponible/i.test(texto)) {
        const entrega = texto.slice(texto.search(/Opciones de entrega/i), texto.search(/Opciones de entrega/i) + 200);
        if (b.disabled || /No Disponible/i.test(entrega)) return { b: null, motivo: 'no disponible para la forma de entrega elegida' };
        return { b };
      }
      if (!b && /página no encontrada|no encontramos/i.test(texto)) return { b: null, motivo: 'el artículo ya no existe' };
      await esperar(400);
    }
    return { b: null, motivo: 'la ficha no cargó a tiempo' };
  }

  const ok = [], mal = [];
  for (let i = 0; i < lista.length; i++) {
    const it = lista[i];
    pintar('Kontea · agregando al carrito', '<div style="height:8px;background:#EEECE6;border-radius:4px;margin:6px 0"><div style="height:8px;width:' + Math.round(i / lista.length * 100) + '%;background:#1F4F8A;border-radius:4px"></div></div>' +
      '<div style="color:#5E6460">' + i + ' de ' + lista.length + ' · artículo ' + esc(it.sku) + '</div><div style="color:#8A8F8B;font-size:12px;margin-top:6px">No cierre esta pestaña.</div>' + aviso);
    try {
      await cargar('/es-cr/producto/p/' + it.sku);
      const d = marco.contentDocument;
      const r = await esperarFicha(d, 25000), boton = r.b;
      const nombre = ((d.querySelector('h1') || {}).textContent || '').trim() || ('Artículo ' + it.sku);
      if (!boton) { mal.push({ ...it, nombre, motivo: r.motivo }); continue; }
      const antes = enCarrito(d);
      const campo = d.querySelector('.sf-quantity-selector input, input[aria-label="Quantity Selector"]');
      const mas = d.querySelector('[data-testid="increase"]');
      for (let k = 1; k < it.cant && mas; k++) { mas.click(); await esperar(120); }
      await esperar(300);
      if (campo && +campo.value !== it.cant) { mal.push({ ...it, nombre, motivo: 'no se pudo poner la cantidad' }); continue; }
      boton.click();
      /* Se confirma solo si el contador del carrito sube en la cantidad pedida */
      const fin = Date.now() + 20000;
      while (enCarrito(d) < antes + it.cant && Date.now() < fin) await esperar(300);
      if (enCarrito(d) >= antes + it.cant) ok.push({ ...it, nombre });
      else mal.push({ ...it, nombre, motivo: 'PriceSmart no confirmó que se agregó' });
    } catch (e) {
      mal.push({ ...it, nombre: 'Artículo ' + it.sku, motivo: 'error al abrir la ficha' });
    }
  }
  marco.remove();

  const fila = (x, color) => '<div style="padding:4px 0;border-bottom:1px solid #EEECE6;color:' + color + '">' + esc(x.cant + ' × ' + x.nombre) + (x.motivo ? ' <span style="color:#A23A2A">(' + esc(x.motivo) + ')</span>' : '') + '</div>';
  pintar(mal.length || faltan.length ? 'Pedido pasado con pendientes' : 'Pedido pasado al carrito',
    '<div style="color:#5E6460;margin-bottom:8px">' + ok.length + ' de ' + lista.length + ' agregados. Revise el carrito antes de pagar.</div>' +
    (mal.length ? '<div style="font-weight:600;margin-top:8px">No se agregaron</div>' + mal.map(x => fila(x, '#1A1D1B')).join('') : '') +
    (faltan.length ? '<div style="font-weight:600;margin-top:8px">Agregar a mano (sin número de artículo)</div>' + faltan.map(n => '<div style="padding:4px 0;border-bottom:1px solid #EEECE6">' + esc(n) + '</div>').join('') : '') +
    aviso + '<div style="color:#8A8F8B;font-size:12px;margin-top:8px">Kontea · favorito v' + VERSION + '</div>', true);
})();
