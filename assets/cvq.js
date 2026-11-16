/* CV en el Quirófano · flujo de revisión, pago con Yappy o PayPal e informe.
   Funciona en dos modos: con el servicio privado (window.CVQ.api) o en demostración (sin api). */
(function () {
  'use strict';
  var C = window.CVQ || {};
  var API = String(C.api || '').replace(/\/$/, '');
  // Sin servicio conectado: demostración fuera de mejorativa.com (o con ?demo). En mejorativa.com, aviso de "muy pronto".
  var EN_SITIO = /(^|\.)mejorativa\.com$/.test(location.hostname);
  var DEMO = !API && (!EN_SITIO || /[?&]demo\b/.test(location.search));
  var CERRADO = !API && !DEMO;
  var ASSETS = new URL('.', document.currentScript.src).href;
  var MODO = document.body.getAttribute('data-cvq');
  var d = document;

  var LATIDOS = [
    'Nombre grande, sin "Currículum Vitae"',
    'Titular con el cargo al que aspiras',
    'Correo nombre.apellido y cero datos sensibles',
    'Perfil de 3 a 4 líneas con al menos un número',
    'Cada logro con verbo, qué, resultado y periodo',
    'Una columna, secciones estándar y PDF que pasa Ctrl+A',
    'Al menos una formación de los últimos 3 años'
  ];
  var SECCIONES = { encabezado: 'Nombre y contacto', titular: 'Titular', perfil: 'Perfil profesional', experiencia: 'Experiencia', formacion: 'Formación', habilidades: 'Habilidades', idiomas: 'Idiomas', extras: 'Extras', diseno: 'Diseño y formato' };
  var ESTADOS = { sano: 'Sano', atencion: 'Atención', urgente: 'Urgente' };

  /* ---------- utilidades ---------- */
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Números que vienen del servidor: siempre se pintan como número, nunca como texto.
  function num(x) { x = Math.round(Number(x)); return isFinite(x) ? x : 0; }
  function fmt(s) { return esc(s).replace(/\[([^\[\]]{1,120})\]/g, '<span class="ph">[$1]</span>'); }
  // Equivalente aproximado en la moneda del país desde donde entra la persona (país que detecta Cloudflare).
  // El cobro sigue en dólares; las tasas viven en cvq-config.js (monedaLocal) con su fecha.
  function precioLocal(pais, usd) {
    var ml = C.monedaLocal || {}, t = pais && ml.paises && ml.paises[pais], m = t && ml.monedas && ml.monedas[t];
    if (!m || !m.tasa || !(Number(usd) > 0)) return '';
    var paso = m.redondeo || 1, v = Math.round((Number(usd) * m.tasa) / paso) * paso;
    var txt = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Unos ' + (m.antes || '') + txt + (m.despues || '') + ' ' + m.nombre + '.';
  }
  function money(n) { var v = Number(n || 0); return '$' + (v % 1 ? v.toFixed(2) : String(v)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function track(ev, data) { try { if (window.umami) window.umami.track(ev, data); } catch (e) { /* nada */ } }
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem('cvq:' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem('cvq:' + k, JSON.stringify(v)); } catch (e) { /* nada */ } },
    del: function (k) { try { sessionStorage.removeItem('cvq:' + k); } catch (e) { /* nada */ } }
  };
  function loadScript(src, mod) {
    return new Promise(function (ok, ko) {
      var s = d.createElement('script');
      if (mod) s.type = 'module';
      s.src = src; s.async = true; s.onload = ok; s.onerror = function () { ko(new Error('No se pudo cargar ' + src)); };
      d.head.appendChild(s);
    });
  }
  var ICO = {
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    delta: '<svg aria-hidden="true"><use href="#delta"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4 4 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  function nivel(v) { return v < 50 ? 'low' : v < 75 ? 'mid' : 'ok'; }

  /* ---------- API (real o demostración) ---------- */
  function demoData() { return DEMO ? loadScript(ASSETS + 'cvq-demo.js') : Promise.resolve(); }
  var demoState = function () { return store.get('demo') || {}; };
  function demoApi(path, o) {
    var D = window.CVQ_DEMO;
    var st = demoState();
    if (path === '/api/config') return Promise.resolve({ ok: true, precio: C.precio || 9.99, demo_pago: true, yappy: { activo: false }, turnstile: null });
    if (path === '/api/diagnostico') return wait(5200).then(function () { store.set('demo', { status: 'diagnosed' }); return { ok: true, id: 'demo', key: 'demo', precio: C.precio || 9.99, diagnostico: D.diagnostico }; });
    if (path === '/api/estado') {
      if (!st.status) return Promise.reject(Object.assign(new Error('No encontramos tu revisión.'), { status: 404 }));
      return Promise.resolve({ ok: true, status: st.status, pagado: st.status !== 'diagnosed', listo: st.status === 'ready', precio: C.precio || 9.99, diagnostico: D.diagnostico, nombre: D.diagnostico.nombre_detectado });
    }
    if (path === '/api/diagnostico/guardar') return wait(700).then(function () { return { ok: true }; });
    if (path === '/api/pago/crear') return wait(600).then(function () { return { ok: true, demo: true, orderId: 'CVQDEMO' }; });
    if (path === '/api/pago/demo') return wait(1800).then(function () { store.set('demo', { status: 'paid' }); return { ok: true }; });
    if (path === '/api/pago/codigo') return wait(900).then(function () { store.set('demo', { status: 'paid' }); return { ok: true, pagado: true }; });
    if (path === '/api/paypal/crear') return wait(600).then(function () { return { ok: true, demo: true, orderId: 'CVQDEMO', paypal_id: 'DEMO-CVQDEMO' }; });
    if (path === '/api/paypal/capturar') return wait(1200).then(function () { store.set('demo', { status: 'paid' }); return { ok: true, pagado: true }; });
    if (path === '/api/informe' && (!o.method || o.method === 'GET')) return Promise.resolve(st.status === 'ready' ? { ok: true, listo: true, informe: D.informe } : { ok: true, listo: false, status: st.status });
    if (path === '/api/borrar') { store.del('demo'); return Promise.resolve({ ok: true }); }
    return Promise.reject(new Error('Ruta demo no soportada'));
  }
  function api(path, o) {
    o = o || {};
    if (DEMO) return demoData().then(function () { return demoApi(path, o); });
    var url = API + path + (o.query ? '?' + new URLSearchParams(o.query) : '');
    return fetch(url, { method: o.method || 'GET', headers: o.body ? { 'content-type': 'application/json' } : {}, body: o.body ? JSON.stringify(o.body) : undefined })
      .catch(function () { throw new Error('No pudimos conectar. Revisa tu internet e intenta de nuevo.'); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.ok === false) { var e = new Error(j.mensaje || 'Algo falló de nuestro lado. Intenta de nuevo.'); e.code = j.error; e.status = r.status; e.data = j; throw e; }
          return j;
        });
      });
  }
  // Pide el informe. El servidor responde en streaming (NDJSON) mientras lo redacta.
  function pedirInforme(ses, onP) {
    if (DEMO) {
      return demoData().then(function () {
        var i = 0;
        return new Promise(function (ok) {
          var t = setInterval(function () { i++; onP(i * 1900); if (i >= 14) { clearInterval(t); store.set('demo', { status: 'ready' }); ok(window.CVQ_DEMO.informe); } }, 520);
        });
      });
    }
    return fetch(API + '/api/informe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ses.id, key: ses.key }) })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('ndjson') === -1) {
          return r.json().then(function (j) {
            if (!r.ok || j.ok === false) throw new Error(j.mensaje || 'No pudimos preparar tu informe.');
            return j.informe || null;
          });
        }
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', final = null;
        function leer() {
          return reader.read().then(function (x) {
            if (x.done) { if (final && final.ok) return final.informe; throw new Error((final && final.mensaje) || 'Se cortó la conexión. Recarga la página: tu informe sigue en preparación.'); }
            buf += dec.decode(x.value, { stream: true });
            var i;
            while ((i = buf.indexOf('\n')) !== -1) {
              var linea = buf.slice(0, i); buf = buf.slice(i + 1);
              if (!linea.trim()) continue;
              var o; try { o = JSON.parse(linea); } catch (e) { continue; }
              if (o.p) onP(o.p);
              if ('ok' in o) final = o;
            }
            return leer();
          });
        }
        return leer();
      });
  }

  /* ---------- país por zona horaria (la persona puede cambiarlo) ---------- */
  (function () {
    try {
      var sel = document.getElementById('f-pais'); if (!sel) return;
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      var p = /^America\/(Mexico_City|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Mazatlan|Tijuana|Matamoros|Ojinaga|Bahia_Banderas)$/.test(tz) ? 'mexico'
        : tz === 'America/Bogota' ? 'colombia'
        : tz === 'America/Costa_Rica' ? 'costarica'
        : /^(Europe\/Madrid|Africa\/Ceuta|Atlantic\/Canary)$/.test(tz) ? 'espana' : '';
      if (p) sel.value = p;
      var otro = document.getElementById('f-pais-otro-box');
      var ver = function () { if (otro) otro.hidden = sel.value !== 'otro'; };
      sel.addEventListener('change', ver); ver();
    } catch (e) { /* se queda en Panamá */ }
  })();

  /* ---------- render del diagnóstico ---------- */
  function ring(v, cls) {
    var r = 54, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, v)) / 100);
    return '<div class="ring ' + (cls || nivel(v)) + '" role="img" aria-label="Puntaje ' + num(v) + ' de 100"><svg viewBox="0 0 128 128"><circle class="track" cx="64" cy="64" r="' + r + '"/><circle class="val" cx="64" cy="64" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/></svg><div class="num"><div><b>' + esc(v) + '</b><small>de 100</small></div></div></div>';
  }
  function animarRings(root) {
    requestAnimationFrame(function () { requestAnimationFrame(function () { $$('.ring .val', root).forEach(function (c) { c.style.strokeDashoffset = c.getAttribute('data-off'); }); }); });
  }
  function examenes(ex) {
    var k = [['maquina', 'La máquina'], ['humano', 'El humano'], ['autenticidad', 'Tu voz']];
    return '<div class="ex3">' + k.map(function (x) {
      var e = (ex && ex[x[0]]) || { puntaje: 0, resumen: '' };
      return '<div class="ex ' + nivel(e.puntaje) + '"><div class="k">' + x[1] + '</div><div class="v"><b>' + esc(e.puntaje) + '</b><span>/ 100</span></div><div class="bar"><i style="--v:' + Number(e.puntaje) + '%"></i></div>' + (e.resumen ? '<p>' + esc(e.resumen) + '</p>' : '<p class="find-lock">' + ICO.lock + '<span>Por qué sacaste este puntaje: en tu informe.</span></p>') + '</div>';
    }).join('') + '</div>';
  }
  // Precio especial que llega por correo (nov. 2026): el servidor manda precio (el que se cobra), precio_normal
  // y oferta_hasta. Sin oferta, solo precio. Lo fija verDiagnostico antes de pintar.
  var ofertaActual = null;
  function fijarOferta(info) {
    ofertaActual = info && info.precio_normal && info.oferta_hasta && info.oferta_hasta * 1000 > Date.now() ? { normal: info.precio_normal, hasta: info.oferta_hasta } : null;
  }
  function precioTxt(precio) { return ofertaActual ? '<s>' + money(ofertaActual.normal) + '</s> ' + money(precio) : money(precio); }
  function ofertaHasta() {
    try { return new Date(ofertaActual.hasta * 1000).toLocaleString('es-PA', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).replace(/\.$/, ''); } catch (e) { return ''; }
  }
  function renderDiagnostico(diag, precio) {
    var n = diag.nombre_detectado || '';
    var lat = diag.latidos || [];
    var si = lat.filter(function (l) { return l.cumple === 'si'; }).length;
    var co = diag.conteos || {};
    var items = [];
    items.push('Tu hoja de vida nueva en formato Harvard, en Word: la ajustas y la envías');
    if (co.logros_por_reescribir) items.push(co.logros_por_reescribir + ' logros reescritos con la fórmula V·Q·L·P');
    if (co.alertas_zona_roja) items.push(co.alertas_zona_roja + ' alertas de zona roja y qué hacer con cada una');
    if (co.palabras_clave_faltantes) items.push(co.palabras_clave_faltantes + ' palabras clave que hoy no aparecen en tu CV');
    items.push('3 carreras o cargos que encajan con tu perfil, con la búsqueda lista en LinkedIn');
    items.push('Tu nuevo titular y tu nuevo perfil, listos para copiar');
    items.push('Tu LinkedIn operado: URL, titular y "Acerca de"');
    items.push('Las 5 preguntas difíciles que te van a hacer en la entrevista');
    items.push('Tu receta para las próximas 48 horas');
    var h = '';
    h += '<span class="label">Diagnóstico listo</span>';
    h += '<h2 id="h-diag" tabindex="-1">' + (n ? esc(n) + ', este' : 'Este') + ' es tu diagnóstico.<span class="soft">Lo que vio el quirófano en tu hoja de vida.</span></h2>';
    h += '<div class="result-head" style="margin-top:24px">' + ring(diag.puntaje_global) + '<div><p class="verdict">' + esc(diag.veredicto) + '</p>' + (diag.lo_que_funciona ? '<p class="good"><b>Lo que ya funciona:</b> ' + esc(diag.lo_que_funciona) + '</p>' : '') + '</div></div>';
    if (diag.cargo_objetivo_inferido) h += '<p class="aim">Lo leí pensando en: <b>' + esc(diag.cargo_objetivo_inferido) + '</b></p>';
    h += examenes(diag.examenes);
    h += '<div class="beats"><div class="dots" aria-hidden="true">' + lat.map(function (l) { return '<i class="' + esc(l.cumple) + '" title="Latido ' + num(l.id) + '"></i>'; }).join('') + '</div><span>' + (si ? 'Cumples <b>' + si + ' de 7</b> latidos completos. El informe te dice cómo cumplir los demás.' : 'Hoy tu CV no cumple <b>ninguno de los 7 latidos</b> completo. Todos tienen arreglo y el informe te dice cómo.') + '</span></div>';
    var cta = function (extra) { return '<div class="cta-buy' + (extra ? ' ' + extra : '') + '"><a class="btn gold cta-big" href="#pay"><span>Quiero mi informe completo · ' + precioTxt(precio) + '</span> <span class="arr"><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span></a><p class="precio-local cta-local" hidden></p>' + (ofertaActual ? '<p class="cta-oferta">Precio especial hasta el ' + esc(ofertaHasta()) + '.</p>' : '') + '<p class="cta-fomo">⏳ Por tu privacidad, tu diagnóstico se borra en 24 horas. Si pides tu informe hoy, te llega al correo en minutos.</p></div>'; };
    h += cta();
    h += '<div class="guardar" id="guardar"><b>¿Lo terminas después?</b><p>Te mando tu diagnóstico al correo y te aviso una sola vez antes de que se borre.</p>'
      + '<div class="guardar-f"><label for="g-correo" class="g-sr">Tu correo</label><input type="email" id="g-correo" autocomplete="email" inputmode="email" maxlength="200" placeholder="tucorreo@gmail.com"><button class="btn sm" type="button" id="g-enviar">Envíame mi diagnóstico</button></div>'
      + '<label class="check g-nov"><input type="checkbox" id="g-nov"><span class="box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="t">También quiero recibir novedades y ofertas de Mejorativa, por correo y en redes sociales.</span></label>'
      + '<p class="g-msg" id="g-msg" role="status" aria-live="polite" hidden></p></div>';
    h += '<h3 style="margin-top:30px">Tus 3 hallazgos más importantes</h3><div class="finds">' + (diag.hallazgos_gratis || []).map(function (f) {
      return '<div class="find"><span class="sev ' + esc(f.severidad) + '">' + esc(f.severidad) + '</span><div><b>' + esc(f.titulo) + '</b>' + (f.detalle ? '<p>' + esc(f.detalle) + '</p><p class="find-lock">' + ICO.lock + '<span>Cómo se arregla, con tu propio texto: en tu informe.</span></p>' : '<p class="find-lock">' + ICO.lock + '<span>Qué encontré y cómo se arregla: en tu informe.</span></p>') + '</div></div>';
    }).join('') + '</div>';
    var mu = diag.muestra || {};
    if (mu.original && mu.reescrito) {
      var resto = num(co.logros_por_reescribir) > 1 ? 'Esta es una sola de tus líneas. En tu informe operamos las ' + num(co.logros_por_reescribir) + ' que hoy cuentan tareas en vez de logros.' : 'Esta es una sola de tus líneas. En tu informe operamos el CV completo.';
      h += '<div class="muestra"><span class="label">Prueba gratis</span><h3>Mira una de tus líneas, operada.</h3><div class="mu-ab"><div class="mu-a"><small>Hoy dice</small><p>' + esc(mu.original) + '</p></div><div class="mu-b"><small>Después del quirófano</small><p>' + fmt(mu.reescrito) + (mu.recortado ? '… <span class="mu-lock" aria-hidden="true"><span></span><span></span></span></p><p class="find-lock">' + ICO.lock + '<span>La línea completa, en tu informe.</span>' : '') + '</p></div></div><p class="mu-note">' + esc(resto) + ' Donde veas <span class="ph">[corchetes]</span>, va tu dato real.</p></div>';
    }
    h += '<div class="locked"><h3>Tu informe completo trae' + (num(co.mejoras) ? ' ' + num(co.mejoras) + ' mejoras concretas' : '') + ':</h3><ul>' + items.map(function (t) { return '<li>' + ICO.lock + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul><div class="blur" aria-hidden="true"><span style="width:92%"></span><span style="width:78%"></span><span style="width:86%"></span><span style="width:60%"></span></div></div>';
    h += cta('cta-mid');
    h += '<div class="why"><span class="label">Por qué vale la pena</span><h3>Si esto fue gratis, imagínate tu informe.</h3><p class="why-lead">Lo que acabas de ver fue el triaje. El informe es la operación completa, línea por línea.</p><div class="why-grid">' + [
      ['Experiencia humana detrás', 'El método lo armé yo, Miguel Capuro, revisando hojas de vida reales en vivo y con lo que dicen los reclutadores. La IA aplica ese mismo criterio a tu hoja de vida.'],
      ['Más de 60 reglas', 'Cada línea de tu CV pasa por las mismas reglas que uso en mi taller CV en el Quirófano: la guía de Harvard, lo que buscan los reclutadores en tu país y los datos que la ley no permite pedirte.'],
      ['La IA más potente que tenemos', 'El diagnóstico lo hizo una IA rápida. Tu informe lo opera uno de los modelos de inteligencia artificial más avanzados del mundo, y se toma su tiempo con tu hoja de vida.'],
      ['Rieles que no se saltan', 'Trabaja solo con los datos de tu CV. No inventa logros ni cifras: donde falta un dato, te lo marca para que pongas el tuyo.']
    ].map(function (w) { return '<div class="why-i"><b>' + esc(w[0]) + '</b><p>' + esc(w[1]) + '</p></div>'; }).join('') + '</div></div>';
    h += '<div class="pay" id="pay"><span class="label" style="color:#A9B6CB">Informe completo</span><h3>Tu informe completo te espera.</h3><div class="price">' + precioTxt(precio) + '<small>pago único · sin suscripción</small></div>' + (ofertaActual ? '<p class="oferta-nota">Precio especial que te llegó por correo, hasta el ' + esc(ofertaHasta()) + '.</p>' : '') + '<p class="precio-local" hidden></p><p class="pay-lead"><b>Te llevas tu hoja de vida nueva, en formato Harvard y en Word.</b> La ajustas con tus datos y la envías. Además, el informe te explica cómo arreglar cada error con tu propio texto.</p><p>Lo ves aquí mismo en unos minutos y te llega a tu correo. Cuesta lo que un almuerzo y te ahorra semanas adivinando qué falla.</p><p class="pay-ej"><a href="' + ASSETS + '../cv-en-el-quirofano/informe/?ejemplo=1#ejemplo" target="_blank" rel="noopener">Mira un informe de ejemplo</a> <span>(se abre en otra pestaña; tu diagnóstico sigue aquí)</span></p><p class="fine-w" style="margin-top:-4px">Tu informe lo opera el modelo de inteligencia artificial más avanzado que tenemos, con los rieles del método: guía de Harvard, el mercado y las leyes del país donde buscas trabajo.</p><div id="pay-body"></div><p class="fine-w">Al pagar aceptas los <a href="' + ASSETS + '../terminos/" target="_blank" rel="noopener">términos</a>. Si tu informe no se entrega, te devolvemos el dinero.</p></div>';
    h += '<p class="uno-a-uno">¿Además del informe quieres revisarlo conmigo? <a href="https://wa.me/' + (C.whatsapp || '50763454868') + '?text=' + encodeURIComponent('Hola Miguel, hice el diagnóstico de CV en el Quirófano y me interesa una sesión 1 a 1 contigo.') + '" target="_blank" rel="noopener">Pide tu sesión 1 a 1 por WhatsApp</a>.</p>';
    return h;
  }

  /* ---------- render del informe ---------- */
  var cvPropuesto = null;
  function lista(arr, cls) { return '<ul class="' + (cls || 'ticks') + '">' + (arr || []).map(function (t) { return '<li>' + ICO.delta + '<span>' + fmt(t) + '</span></li>'; }).join('') + '</ul>'; }
  function sec(label, titulo, cuerpo, lead) { return '<section class="rep-sec"><span class="label">' + esc(label) + '</span><h3>' + esc(titulo) + '</h3>' + (lead ? '<p class="lead">' + esc(lead) + '</p>' : '') + cuerpo + '</section>'; }
  function copiable(t) { return '<div class="copybox">' + fmt(t) + '<button class="cp" type="button" data-copy="' + esc(t) + '">Copiar</button></div>'; }
  // Pestañas del informe: el contenido completo, repartido para que se lea por partes y no abrume.
  // Al imprimir o guardar en PDF se ven todas, una tras otra.
  // Índice del informe: las 6 partes a la vista, cada una con lo que trae (en cifras reales del informe),
  // para que la persona vea de un vistazo todo lo que recibió y lea por partes sin saturarse.
  // Al imprimir o guardar en PDF se ven todas, una tras otra.
  function nn(x) { return (x || []).length; }
  var TABS = [
    ['resumen', 'Tu diagnóstico', function () { return 'Lo urgente y tu plan de 48 horas'; }, 'Qué ya funciona, qué arreglar primero y qué hacer en las próximas 48 horas.'],
    ['cv', 'Tu CV, operado', function (inf) {
      var l = (inf.experiencia || []).reduce(function (s, j) { return s + nn(j.logros); }, 0);
      return (l ? l + ' logros reescritos' : nn(inf.secciones) + ' secciones operadas') + ', listos para copiar';
    }, 'Tu nuevo titular, tu perfil, cada sección y tus logros reescritos. Copia y pega.'],
    ['riesgos', 'Lo que te descarta', function (inf) {
      var z = nn(inf.zona_roja), k = nn((inf.ats || {}).palabras_clave_faltantes);
      return [z ? z + (z === 1 ? ' alerta' : ' alertas') + ' de zona roja' : '', k ? k + ' palabras clave que faltan' : ''].filter(Boolean).join(' · ') || 'Cómo te lee la máquina';
    }, 'Lo que puede sacarte del proceso antes de la entrevista, y cómo te lee el sistema de filtro (ATS).'],
    ['linkedin', 'Tu LinkedIn', function () { return 'Titular y «Acerca de», listos'; }, 'Te buscan en LinkedIn antes de llamarte. Aquí lo dejas igual de fuerte que tu CV.'],
    ['entrevista', 'Tu entrevista', function (inf) {
      var q = nn(inf.preguntas_entrevista), r = nn(inf.rutas_profesionales);
      return [q ? q + ' preguntas difíciles' : '', r ? r + ' cargos que encajan contigo' : ''].filter(Boolean).join(' · ') || 'Lo que te van a preguntar';
    }, 'Lo que te van a preguntar, cómo prepararlo y hacia qué cargos apuntar.'],
    ['harvard', 'Tu CV nuevo', function () { return 'Formato Harvard, en Word'; }, 'Tu hoja de vida armada con todo lo anterior. La descargas, la ajustas y la envías.']
  ];
  function pestanas(T, inf) {
    var tabs = TABS.filter(function (t) { return T[t[0]]; });
    var h = '<div class="rtabs-wrap" id="rtabs-top"><div class="rtabs-head no-print"><span class="label">Lo que trae tu informe</span><p>' + tabs.length + ' partes. Toca la que quieras ver; te recomiendo empezar por la 1.</p></div><div class="rtabs no-print" role="tablist" aria-label="Partes de tu informe">';
    h += tabs.map(function (t, i) { return '<button class="rtab" type="button" role="tab" id="rtab-' + t[0] + '" aria-controls="rpan-' + t[0] + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-tab="' + t[0] + '"><span class="n">' + (i + 1) + '</span><span class="tx"><b>' + esc(t[1]) + '</b><small>' + esc(t[2](inf)) + '</small></span></button>'; }).join('');
    h += '</div>';
    h += tabs.map(function (t, i) {
      var sig = tabs[i + 1];
      return '<div class="rpanel" role="tabpanel" id="rpan-' + t[0] + '" aria-labelledby="rtab-' + t[0] + '" tabindex="-1"' + (i === 0 ? '' : ' hidden') + '><p class="rpanel-intro no-print"><b>Parte ' + (i + 1) + ' de ' + tabs.length + ' · ' + esc(t[1]) + '.</b> ' + esc(t[3]) + '</p>' + T[t[0]] +
        '<div class="rpanel-next no-print">' + (sig ? '<button class="btn gold" type="button" data-tab-ir="' + sig[0] + '">Sigue con la parte ' + (i + 2) + ': ' + esc(sig[1]) + ' →</button>' : '') + '<button class="rpanel-all" type="button" data-tab-ir="' + t[0] + '">Ver las ' + tabs.length + ' partes ↑</button></div></div>';
    }).join('');
    return h + '</div>';
  }
  function renderInforme(inf, ses) {
    var p = inf.puntajes || {};
    var g = p.global != null ? p.global : '';
    var fecha = inf.generado ? new Date(inf.generado * 1000).toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    var h = '';
    var T = { resumen: '', cv: '', riesgos: '', linkedin: '', entrevista: '', harvard: '' };
    h += '<div class="rep-cover"><div><span class="label">Informe · CV en el Quirófano</span><h2>' + (inf.nombre ? esc(inf.nombre) + ', tu' : 'Tu') + ' hoja de vida, operada.</h2><p>' + (inf.cargo_objetivo ? 'Cargo objetivo: ' + esc(inf.cargo_objetivo) + '. ' : '') + esc(fecha) + '</p></div>' + (g !== '' ? ring(g) : '') + '</div>';
    var ej = ses && ses.ejemplo;
    h += '<div class="toolbar no-print"><button class="tbtn" type="button" data-act="print">Guardar en PDF</button>' + (ses && ses.id !== 'demo' ? '<button class="tbtn" type="button" data-act="link">Copiar enlace del informe</button>' : '') + (ej ? '' : '<button class="tbtn danger" type="button" data-act="borrar">Borrar mis datos ahora</button>') + '</div>';
    // Atajo al CV en formato Harvard (está al final del informe y es lo que la persona más busca).
    if (inf.cv_propuesto && inf.cv_propuesto.nombre !== undefined) h += '<a class="harvard-jump no-print" href="#cv-harvard" data-tab-ir="harvard"><span><b>Tu CV en formato Harvard está listo</b><small>Es la parte 6 de tu informe: la descargas en Word y la ajustas.</small></span><span class="go">Ver mi CV →</span></a>';
    if (p.examenes) h += examenes(p.examenes);
    T.resumen += sec('Apertura', 'Antes de operar.', '<div class="rep-text"><p>' + fmt(inf.apertura) + '</p><p>' + fmt(inf.diagnostico_general) + '</p></div>');
    T.resumen += sec('Lo que funciona', 'Empecemos por lo bueno.', lista(inf.lo_que_funciona) + '<div class="prio"><b>Si solo haces una cosa</b><p>' + fmt(inf.prioridad_uno) + '</p></div>');
    if (inf.avisos && inf.avisos.length) {
      T.resumen += sec('Antes de postular', 'Lo que debes saber de esta vacante.', lista(inf.avisos));
    }
    T.resumen += sec('Signos vitales', 'Los 7 latidos de tu CV.', '<div class="beat-list">' + (inf.latidos || []).map(function (l) {
      var t = { si: 'Sí', parcial: '½', no: 'No' }[l.cumple] || '';
      return '<div class="beat"><span class="st ' + esc(l.cumple) + '">' + t + '</span><div><b>' + esc(LATIDOS[l.id - 1] || ('Latido ' + l.id)) + '</b><p>' + fmt(l.evidencia) + '</p>' + (l.como_arreglarlo ? '<p class="fix">' + fmt(l.como_arreglarlo) + '</p>' : '') + '</div></div>';
    }).join('') + '</div>');
    if (inf.espejo && inf.espejo.length) {
      T.resumen += sec('El espejo', 'Lo que tú viste y lo que vio el quirófano.', '<div class="mirror">' + inf.espejo.map(function (m) {
        return '<div><div class="you"><small>Tú marcaste · ' + esc(LATIDOS[m.latido_id - 1] || '') + '</small>' + fmt(m.tu_viste) + '</div><div class="we"><small>El quirófano vio</small>' + fmt(m.el_quirofano_vio) + '</div></div>';
      }).join('') + '</div>', 'Nada es como lo recuerdas. Tampoco tu hoja de vida.');
    }
    T.cv += sec('Tus primeras líneas', 'Tu nuevo titular y tu nuevo perfil.', '<p class="kw-h">Titular</p>' + copiable(inf.nuevo_titular) + '<p class="kw-h">Perfil profesional</p>' + copiable(inf.nuevo_perfil) + '<p class="note-sm">Donde veas <span class="ph">[corchetes]</span>, pon tu dato real. Si no lo tienes exacto, usa un estimado honesto. Nunca lo inventes: en la entrevista te lo van a preguntar.</p>');
    T.cv += sec('Cirugía', 'Sección por sección.', '<div class="secs">' + (inf.secciones || []).map(function (s) {
      return '<article class="sec-card"><header><b>' + esc(s.titulo || SECCIONES[s.id] || s.id) + '</b><span class="estado ' + esc(s.estado) + '">' + esc(ESTADOS[s.estado] || s.estado) + '</span></header><p>' + fmt(s.diagnostico) + '</p>' + lista(s.recomendaciones, '') +
        (s.antes || s.despues ? '<div class="ba2">' + (s.antes ? '<div class="a"><small>Hoy</small>' + fmt(s.antes) + '</div>' : '') + (s.despues ? '<div class="d"><small>Operado</small>' + fmt(s.despues) + '</div>' : '') + '</div>' : '') + '</article>';
    }).join('') + '</div>');
    if (inf.coherencia && inf.coherencia.length) {
      T.cv += sec('Coherencia', 'Lo que no cuadra.', '<div class="secs">' + inf.coherencia.map(function (c) { return '<article class="sec-card"><p>' + fmt(c.hallazgo) + '</p><p class="how">' + fmt(c.como_corregir) + '</p></article>'; }).join('') + '</div>', 'Un reclutador desconfiado lee buscando contradicciones. Que no encuentre ninguna.');
    }
    if (inf.experiencia && inf.experiencia.length) {
      T.cv += sec('La cirugía mayor', 'Tus logros, operados.', (inf.experiencia || []).map(function (j) {
        return '<div class="job"><header><b>' + esc(j.cargo) + '</b><span>' + esc(j.empresa) + (j.periodo ? ' · ' + esc(j.periodo) : '') + '</span></header><p>' + fmt(j.comentario) + '</p>' + (j.logros || []).map(function (l) {
          return '<div class="logro"><div class="o">' + esc(l.original) + '</div><div class="r"><span>' + fmt(l.reescrito) + '</span><button class="cp" type="button" data-copy="' + esc(l.reescrito) + '">Copiar</button></div>' + (l.datos_por_confirmar && l.datos_por_confirmar.length ? '<div class="need">' + l.datos_por_confirmar.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      }).join(''), 'Fórmula V·Q·L·P: verbo en pasado, qué hiciste, qué cambió gracias a ti y cuándo. Un adjetivo es una promesa. Un resultado es una prueba.');
    }
    if (inf.zona_roja && inf.zona_roja.length) {
      T.riesgos += sec('Zona roja', 'Lo que te puede costar la entrevista.', '<div class="risk">' + inf.zona_roja.map(function (z) {
        return '<div><span class="x">' + ICO.x + '</span><div><b>' + esc(z.dato) + '</b><p>' + fmt(z.donde) + '. ' + fmt(z.por_que) + '</p><p class="do">' + fmt(z.que_hacer) + '</p></div></div>';
      }).join('') + '</div>', 'Tu hoja de vida responde una sola pregunta: ¿puedes hacer este trabajo? Lo demás es ruido o riesgo.');
    }
    var a = inf.ats || {};
    T.riesgos += sec('Rayos X', 'Cómo te lee la máquina.', '<span class="legi ' + esc(a.legibilidad) + '">Legibilidad ' + esc(a.legibilidad || '') + '</span><div class="rep-text"><p>' + fmt(a.explicacion) + '</p></div>' +
      (a.secciones_no_estandar && a.secciones_no_estandar.length ? '<p class="kw-h">Secciones que conviene renombrar</p>' + lista(a.secciones_no_estandar, '') : '') +
      (a.palabras_clave_presentes && a.palabras_clave_presentes.length ? '<p class="kw-h">Palabras clave que ya tienes</p><div class="kw si">' + a.palabras_clave_presentes.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('') + '</div>' : '') +
      (a.palabras_clave_faltantes && a.palabras_clave_faltantes.length ? '<p class="kw-h">Palabras clave que te faltan</p><div class="kw no">' + a.palabras_clave_faltantes.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('') + '</div>' : '') +
      (a.nota_palabras_clave ? '<p class="note-sm">' + fmt(a.nota_palabras_clave) + '</p>' : '') +
      '<p class="note-sm">La prueba de oro: abre tu PDF, Ctrl+A, copia y pega en el Bloc de notas. Si sale desordenado, así te lee el ATS.</p>');
    var au = inf.autenticidad || {};
    if (au.comentario || (au.frases_genericas && au.frases_genericas.length)) {
      T.riesgos += sec('Tu voz', 'Lo que suena a plantilla.', '<div class="rep-text"><p>' + fmt(au.comentario) + '</p></div>' + (au.frases_genericas || []).map(function (f) {
        return '<div class="ba2"><div class="a"><small>Suena a plantilla</small>' + fmt(f.frase) + '</div><div class="d"><small>Con evidencia</small>' + fmt(f.alternativa) + '</div></div>';
      }).join('') + (au.consejos_redaccion && au.consejos_redaccion.length ? '<p class="kw-h">Para que suene a ti</p>' + lista(au.consejos_redaccion) : ''));
    }
    var hi = inf.historia || {};
    if (hi.aplica) {
      T.entrevista += sec('Tu historia', 'Pausas, saltos y crecimiento.', '<div class="rep-text"><p>' + fmt(hi.analisis) + '</p></div>' + (hi.respuesta_20_segundos ? '<p class="kw-h">Tu respuesta de 20 segundos para la entrevista</p>' + copiable(hi.respuesta_20_segundos) : ''), 'Lo que escondes te controla. Lo que nombras, lo transformas.');
    }
    if (inf.sesgos && inf.sesgos.length) {
      T.riesgos += sec('Lo que nadie te dice', 'Los sesgos que tu CV puede activar.', '<div class="secs">' + inf.sesgos.map(function (s) { return '<article class="sec-card"><header><b>' + esc(s.sesgo) + '</b></header><p>' + fmt(s.jugada) + '</p></article>'; }).join('') + '</div>', 'Los sesgos no se combaten escondiéndote. Se desactivan con evidencia.');
    }
    var li = inf.linkedin || {};
    T.linkedin += sec('Tu segundo quirófano', 'Tu LinkedIn.', '<div class="rep-text"><p>' + fmt(li.url) + '</p><p>' + fmt(li.coherencia) + '</p></div><p class="kw-h">Titular sugerido</p>' + copiable(li.titular_sugerido) + '<p class="kw-h">"Acerca de" sugerido</p>' + copiable(li.acerca_de_sugerido) + lista(li.recomendaciones) + '<p class="note-sm">Te van a buscar en redes antes de llamarte. ¿Están actualizadas? ¿Muestran lo que quieres que vean?</p>');
    T.entrevista += sec('Ensayo general', 'Las 5 preguntas difíciles.', '<div class="qs">' + (inf.preguntas_entrevista || []).map(function (q) { return '<div><b>' + fmt(q.pregunta) + '</b><p>' + fmt(q.por_que) + '</p><p class="how">' + fmt(q.como_prepararla) + '</p></div>'; }).join('') + '</div>', 'Lo que escribiste, te lo van a preguntar. Prepáralo hoy.');
    if ((inf.rutas_profesionales || []).length) {
      T.entrevista += sec('Hacia dónde ir', 'Carreras que encajan contigo.', '<div class="rutas">' + inf.rutas_profesionales.map(function (r) {
        var url = 'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(r.busqueda || r.cargo) + (r.ubicacion ? '&location=' + encodeURIComponent(r.ubicacion) : '');
        return '<article class="sec-card"><header><b>' + esc(r.cargo) + '</b></header><p>' + fmt(r.por_que_encaja) + '</p>' + (r.brecha ? '<p class="how"><b>Para competir:</b> ' + fmt(r.brecha) + '</p>' : '') + '<p><a class="link" href="' + url + '" target="_blank" rel="noopener">Ver ofertas en LinkedIn' + (r.ubicacion ? ' · ' + esc(r.ubicacion) : '') + '</a></p></article>';
      }).join('') + '</div>', 'Según lo que muestra tu CV. Abre cada búsqueda, mira las ofertas de hoy y postula solo donde puedas contar evidencia.');
    }
    T.resumen += sec('Receta médica', 'Tus próximas 48 horas.', '<ol class="rx">' + (inf.receta_48h || []).map(function (r) { return '<li><div><b>' + fmt(r.paso) + '</b><p>' + fmt(r.detalle) + '</p></div></li>'; }).join('') + '</ol>', 'Lo que no se hace en 48 horas, normalmente no se hace.');
    if (inf.aviso_ia) T.resumen += '<p class="note-sm" style="margin-top:28px">' + esc(inf.aviso_ia) + '</p>';
    if (inf.cv_propuesto && inf.cv_propuesto.nombre !== undefined) {
      cvPropuesto = inf.cv_propuesto;
      T.harvard += '<div id="cv-harvard" class="anchor-harvard"></div>';
      T.harvard += sec('Tu CV, operado', 'Tu hoja de vida en formato Harvard.', '<div class="cvh"><p>Es una propuesta armada solo con tus datos y con todo lo que viste en este informe. Antes de enviarla, ajústala:</p>' + lista([
        'Completa lo que está resaltado en amarillo con tus datos reales. Si no tienes el número exacto, usa un estimado honesto. Nunca lo inventes: en la entrevista te lo van a preguntar.',
        'Léela en voz alta. Si una línea no suena a ti, cámbiala. La IA propone y tú decides.',
        'Revisa nombres, fechas y cargos contra tus documentos.',
        'Cuando quede lista, guárdala en PDF para postular, salvo que el aviso pida Word.'
      ]) + '<p class="no-print" style="margin-top:16px"><button class="btn gold" type="button" data-act="docx">Descargar mi CV en Word</button></p><p class="note-sm">Es una propuesta: la versión final que envíes y lo que dice son tuyos. Revísala con calma antes de usarla.</p></div>');
    }
    h += pestanas(T, inf);
    h += '<div class="signoff"><blockquote>' + fmt(inf.cierre) + '</blockquote><div class="who"><img src="' + ASSETS + '../img/miguel-capuro-160.webp" alt="" width="52" height="52"><div><b>Miguel Capuro</b><span>Líder de Mejorativa · Damos lo que somos. Ni más, ni menos.</span></div></div></div>';
    h += '<div class="next no-print"><a href="https://wa.me/' + (C.whatsapp || '50763454868') + '?text=' + encodeURIComponent('Hola Miguel, ya tengo mi informe de CV en el Quirófano y quiero una sesión 1 a 1 para revisarlo juntos.') + '" target="_blank" rel="noopener"><b>¿Lo revisamos juntos?</b><span>Una sesión 1 a 1 con Miguel para tu CV, tu LinkedIn o tu próxima entrevista. $100 la hora.</span></a><a href="' + ASSETS + '../negociacion/"><b>¿Te llamaron? Negocia tu oferta.</b><span>Cuando llegue la propuesta, el taller Negociar sin Romper te enseña a pedir lo que vales.</span></a><a href="' + ASSETS + '../presentaciones/"><b>Preséntate con seguridad.</b><span>Presentar sin Aburrir: para la entrevista y para lo que viene después.</span></a><a href="' + ASSETS + '../empresas/"><b>¿Tu equipo necesita esto?</b><span>CV en el Quirófano en vivo para tu empresa, universidad o club.</span></a></div>';
    h += '<p class="note-sm">Este informe lo preparó una inteligencia artificial con el método CV en el Quirófano de Mejorativa. Revísalo con criterio: cada línea de tu CV la tienes que poder defender en la entrevista. No garantiza un empleo.</p>';
    return h;
  }

  function conectarInforme(root, ses) {
    function irTab(k, foco, subir) {
      var tab = root.querySelector('.rtab[data-tab="' + k + '"]');
      if (!tab) return;
      Array.prototype.forEach.call(root.querySelectorAll('.rtab'), function (t) { var on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      Array.prototype.forEach.call(root.querySelectorAll('.rpanel'), function (p) { p.hidden = p.id !== 'rpan-' + k; });
      var top = root.querySelector('#rtabs-top');
      // «Siguiente» y «Ver mi CV» siempre llevan al inicio de la parte nueva; tocar una pestaña solo sube si ya pasaste la barra.
      if (top && (subir || top.getBoundingClientRect().top < 0)) top.scrollIntoView({ block: 'start' });
      if (foco) tab.focus();
      track('cv_informe_tab', { tab: k });
    }
    root.addEventListener('keydown', function (e) {
      var t = e.target.closest && e.target.closest('.rtab');
      if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var all = Array.prototype.slice.call(root.querySelectorAll('.rtab'));
      var i = all.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
      e.preventDefault(); irTab(all[(i + all.length) % all.length].getAttribute('data-tab'), true);
    });
    root.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-tab],[data-tab-ir]');
      if (tb) { e.preventDefault(); irTab(tb.getAttribute('data-tab') || tb.getAttribute('data-tab-ir'), false, tb.hasAttribute('data-tab-ir')); return; }
      var b = e.target.closest('[data-copy],[data-act]');
      if (!b) return;
      if (b.hasAttribute('data-copy')) {
        var t = b.getAttribute('data-copy');
        var hecho = function () { var o = b.textContent; b.textContent = 'Copiado'; setTimeout(function () { b.textContent = o; }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(hecho, function () { window.prompt('Copia el texto:', t); }); else window.prompt('Copia el texto:', t);
        track('cv_copiar');
        return;
      }
      var act = b.getAttribute('data-act');
      if (act === 'print') { track('cv_pdf'); window.print(); }
      if (act === 'docx') { if (cvPropuesto && window.CVQ_DOCX) { track('cv_docx'); window.CVQ_DOCX.descargar(cvPropuesto); } return; }
      if (act === 'link') {
        var url = new URL('../informe/#' + ses.id + '.' + ses.key, location.href).href;
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { b.textContent = 'Enlace copiado'; });
        else window.prompt('Copia tu enlace:', url);
      }
      if (act === 'borrar') {
        var tb = b.closest('.toolbar');
        if (!tb.querySelector('.confirm')) {
          var cf = d.createElement('div');
          cf.className = 'confirm';
          cf.innerHTML = '<span>¿Borramos tu informe y todo lo que nos enviaste? No se puede deshacer.</span><button class="tbtn danger" type="button" data-act="borrar-si">Sí, borrar todo</button><button class="tbtn" type="button" data-act="borrar-no">Cancelar</button>';
          tb.appendChild(cf);
        }
        return;
      }
      if (act === 'borrar-no') { var c0 = b.closest('.confirm'); if (c0) c0.remove(); return; }
      if (act === 'borrar-si') {
        b.disabled = true;
        api('/api/borrar', { method: 'POST', body: { id: ses.id, key: ses.key } }).then(function () {
          store.del('ses'); store.del('form');
          root.innerHTML = '<div class="panel"><h2>Listo, borrado.<span class="soft">No queda nada tuyo en nuestro sistema.</span></h2><p class="sub">Si guardaste el PDF, ese archivo es tuyo. Gracias por confiar en el quirófano.</p></div>';
        }).catch(function (err) { b.disabled = false; b.textContent = err.message; });
      }
    });
  }

  /* ---------- lectura de archivos ---------- */
  function aBase64(buf) {
    var bytes = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  // Hasta 10 páginas (nov. 2026). Si el PDF trae más, el servidor revisa solo las primeras 10 y la página lo avisa.
  var MAX_PAG = 10, MAX_WORD = 40000;
  function leerPDF(buf) {
    return import(ASSETS + 'vendor/pdf.min.js').then(function (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = ASSETS + 'vendor/pdf.worker.min.js';
      return pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise.then(function (doc) {
        var n = doc.numPages, textos = [], p = Promise.resolve();
        for (var i = 1; i <= Math.min(n, MAX_PAG); i++) {
          (function (k) {
            p = p.then(function () { return doc.getPage(k); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
              textos.push(tc.items.map(function (it) { return (it.str || '') + (it.hasEOL ? '\n' : ' '); }).join(''));
            });
          })(i);
        }
        return p.then(function () { return { paginas: n, texto: textos.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() }; });
      });
    });
  }
  function leerDOCX(buf) {
    var listo = window.mammoth ? Promise.resolve() : loadScript(ASSETS + 'vendor/mammoth.browser.min.js');
    return listo.then(function () { return window.mammoth.extractRawText({ arrayBuffer: buf }); }).then(function (r) { return { paginas: null, texto: String(r.value || '').trim() }; });
  }
  function procesarArchivo(file) {
    var nombre = file.name || 'archivo';
    var ext = (nombre.split('.').pop() || '').toLowerCase();
    function falla(motivo, msg) { return Object.assign(new Error(msg), { motivo: motivo }); }
    if (file.size > 2 * 1024 * 1024) return Promise.reject(falla('pesado', 'Tu archivo pesa más de 2 MB. ¿Venía con certificados o anexos? Sube solo tu hoja de vida. Si aun así pesa mucho, guárdala de nuevo como PDF desde Word o Google Docs.'));
    if (ext === 'doc') return Promise.reject(falla('doc_antiguo', 'Los archivos .doc antiguos no se pueden leer. Guárdalo como PDF o como .docx.'));
    var esPDF = ext === 'pdf' || file.type === 'application/pdf';
    var esDOCX = ext === 'docx';
    var foto = /^(jpe?g|png|heic|heif|webp|gif)$/.test(ext) || /^image\//.test(file.type || '');
    if (!esPDF && !esDOCX) return Promise.reject(falla(foto ? 'formato_foto' : ext === 'pages' ? 'formato_pages' : ext === 'odt' ? 'formato_odt' : 'formato_otro',
      foto ? 'Eso parece una foto. Sube tu hoja de vida en PDF o en Word (.docx), o pega su texto en «Pegar el texto de mi CV».' : 'Sube tu hoja de vida en PDF o en Word (.docx).'));
    return file.arrayBuffer().then(function (buf) {
      if (esPDF) {
        return leerPDF(buf).catch(function () { return { paginas: null, texto: '' }; }).then(function (r) {
          return { tipo: 'pdf', pdf_b64: aBase64(buf), texto: r.texto, meta: { paginas: r.paginas, caracteres: r.texto.length, nombre_archivo: nombre } };
        });
      }
      return leerDOCX(buf).then(function (r) {
        if (r.texto.length < 200) throw falla('word_vacio', 'No pudimos leer suficiente texto de tu Word. Prueba guardándolo como PDF.');
        // Word muy largo: se revisa el comienzo (unas 10 páginas) en vez de rechazarlo.
        var largo = r.texto.length > MAX_WORD;
        var t = largo ? r.texto.slice(0, MAX_WORD) : r.texto;
        return { tipo: 'docx', texto: t, largo: largo, meta: { paginas: null, caracteres: t.length, nombre_archivo: nombre } };
      });
    });
  }

  /* ---------- configuración del servicio ---------- */
  var config = null;
  function cargarConfig() {
    if (config) return Promise.resolve(config);
    return api('/api/config').then(function (c) { config = c; return c; }).catch(function () { config = { precio: C.precio || 9.99, demo_pago: false, yappy: { activo: false } }; return config; });
  }

  /* ---------- flujo de revisión ---------- */
  function appRevisar() {
    var paneles = ['cv', 'cirugia', 'diag', 'redactando', 'informe'];
    var cv = null;
    var liTexto = '';
    var tsToken = null;

    if (DEMO) { var f = $('#demo-flag'); if (f) f.hidden = false; }
    if (CERRADO) {
      $('#p-cv').innerHTML = '<h2>Muy pronto.<span class="soft">El quirófano abre en unos días.</span></h2><p class="sub">Mientras tanto, escríbeme y te cuento cómo revisar tu hoja de vida.</p><div class="actions"><a class="btn" href="https://wa.me/' + (C.whatsapp || '50763454868') + '" target="_blank" rel="noopener">Escribir por WhatsApp</a></div>';
      return;
    }

    function mostrar(nombre) {
      paneles.forEach(function (p) { var el = $('#p-' + p); if (el) el.hidden = p !== nombre; });
      var h = $('#p-' + nombre + ' h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    function alerta(id, msg) { var a = $(id); if (!a) return; a.innerHTML = msg ? esc(msg) : ''; a.hidden = !msg; }

    // Embudo antes del diagnóstico (panel, sin cookies): cada paso se manda una sola vez por visita.
    var pasosDados = {};
    function paso(nombre, motivo) {
      var k = nombre + (motivo || '');
      if (DEMO || pasosDados[k]) return;
      pasosDados[k] = true;
      api('/api/paso', { method: 'POST', body: motivo ? { paso: nombre, motivo: motivo } : { paso: nombre } }).catch(function () { /* medir nunca rompe nada */ });
    }
    // Lleva a la persona justo a lo que le falta y lo resalta un momento.
    function senalar(el) {
      if (!el) return;
      try { el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); } catch (e) { /* nada */ }
      el.classList.remove('pt-falta'); void el.offsetWidth; el.classList.add('pt-falta');
      setTimeout(function () { el.classList.remove('pt-falta'); }, 2600);
    }
    [['#pt-luego', 'abrio_luego'], ['#pt-li', 'abrio_linkedin'], ['#pt-pegar', 'abrio_pegar']].forEach(function (x) {
      var d = $(x[0]); if (d) d.addEventListener('toggle', function () { if (d.open) paso(x[1]); });
    });

    // Lo opcional se recuerda mientras la pestaña esté abierta (nunca el archivo)
    var form = $('#cvq-form');
    function datos() {
      var fd = new FormData(form);
      return { li_url: fd.get('li_url') || '', vacante: fd.get('vacante') || '' };
    }
    var previo = store.get('form');
    if (previo) ['li_url', 'vacante'].forEach(function (k) { if (previo[k] && form.elements[k]) form.elements[k].value = previo[k]; });
    form.addEventListener('input', function () { store.set('form', datos()); });

    // Hoja de vida
    var drop = $('#drop'), input = $('#cv-file');
    function elegir(file) {
      alerta('#e-cv', ''); alerta('#e-cv1', '');
      drop.classList.add('has');
      drop.innerHTML = '<div class="file-ok"><span class="spinner" style="width:28px;height:28px;border-width:2.5px"></span><div><b>Leyendo tu archivo…</b><small>' + esc(file.name) + '</small></div></div>';
      cv = null;
      procesarArchivo(file).then(function (r) {
        cv = r;
        paso('cv_listo');
        var det = r.tipo === 'pdf' ? (r.meta.paginas ? r.meta.paginas + ' página' + (r.meta.paginas > 1 ? 's' : '') + ' · ' : '') + (r.texto.length > 200 ? 'la máquina puede leer el texto' : 'casi no hay texto que una máquina pueda leer') : 'Word · ' + r.texto.length + ' caracteres';
        if (r.tipo === 'pdf' && r.meta.paginas > MAX_PAG) det += '. Reviso las primeras ' + MAX_PAG + ' páginas: si trae certificados o anexos, no hacen falta';
        if (r.largo) det += '. Es muy largo: reviso el comienzo, unas ' + MAX_PAG + ' páginas';
        drop.innerHTML = '<div class="file-ok"><svg class="ico" aria-hidden="true"><use href="#i-cv"/></svg><div><b>' + esc(file.name) + '</b><small>' + esc(det) + '. Toca para cambiarlo.</small></div></div>';
        // Archivo listo: lleva a la persona al último paso (aceptar y ver su diagnóstico) en vez de dejarla buscando el botón.
        var op = $('#operar');
        if (op) {
          op.classList.add('listo');
          var p2 = $('#paso-2') || op;
          try { p2.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch (e2) { /* sin scroll suave */ }
        }
      }).catch(function (e) {
        drop.classList.remove('has');
        drop.innerHTML = drop.getAttribute('data-vacio');
        paso('archivo_error', (e && e.motivo) || 'lectura');
        alerta('#e-cv1', e.message);
        senalar(drop);
      });
    }
    drop.setAttribute('data-vacio', drop.innerHTML);
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { if (input.files[0]) elegir(input.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) elegir(f); });

    // Sin archivo: también puede pegar el texto de su hoja de vida.
    var pegado = $('#cv-texto'), est = $('#cv-texto-est');
    if (pegado) pegado.addEventListener('input', function () {
      var t = String(pegado.value || '').replace(/\r/g, '').trim();
      if (input.files && input.files[0]) return; // si subió archivo, manda el archivo
      if (t.length >= 200) {
        cv = { tipo: 'texto', texto: t, meta: { paginas: null, caracteres: t.length, nombre_archivo: 'Texto pegado' } };
        paso('cv_listo');
        if (est) { est.textContent = 'Listo: ' + t.length + ' caracteres. Ahora el paso 2: marca la casilla y toca «Ver mi diagnóstico gratis».'; alerta('#e-cv1', ''); est.className = 'pt-pegar-est ok'; }
        var op = $('#operar'); if (op) op.classList.add('listo');
        if (!pegado.dataset.avisado) { pegado.dataset.avisado = '1'; try { if (localStorage.getItem('mj_consent_meta') === 'si' && window.fbq) window.fbq('trackCustom', 'SubioCV', { content_name: 'CV en el Quirófano', modo: 'texto' }); } catch (e3) { /* nada */ } }
      } else {
        if (cv && cv.tipo === 'texto') cv = null;
        if (est) { est.textContent = t ? 'Pega un poco más: falta texto para revisarlo (' + t.length + ' de 200 caracteres como mínimo).' : ''; est.className = 'pt-pegar-est'; }
      }
    });

    // Llegó desde el correo de recordatorio (?r=...): se manda con el diagnóstico para que no le lleguen más.
    function recordatorioToken() {
      var m = /[?&]r=([A-Za-z0-9_-]{20,64})/.exec(location.search);
      if (m) { store.set('r', m[1]); return m[1]; }
      return store.get('r') || undefined;
    }
    recordatorioToken();

    // Turnstile (opcional)
    function prepararTurnstile() {
      cargarConfig().then(function (c) {
        if (!c.turnstile || window.turnstile) return;
        window.cvqTs = function (t) { tsToken = t; };
        $('#ts-box').innerHTML = '<div class="cf-turnstile" data-sitekey="' + esc(c.turnstile) + '" data-callback="cvqTs" data-language="es"></div>';
        loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js');
      });
    }
    prepararTurnstile();

    // Enviar al quirófano
    var etapas, tEtapas;
    function animarEtapas() {
      etapas = $$('#stages li'); var i = 0;
      etapas.forEach(function (li) { li.className = ''; });
      etapas[0].className = 'now';
      tEtapas = setInterval(function () {
        if (i < etapas.length - 1) { etapas[i].className = 'done'; i++; etapas[i].className = 'now'; }
      }, 3200);
    }
    function pararEtapas() { clearInterval(tEtapas); }

    $('#operar').addEventListener('click', function () {
      var x = datos();
      paso('toco_ver');
      if (!cv) { paso('bloqueo', 'sin_cv'); alerta('#e-cv', ''); alerta('#e-cv1', 'Te falta el paso 1: sube tu CV, pega su texto o elige «Lo hago después» y te mando el enlace al correo.'); senalar(drop); return; }
      if (!$('#c-ok').checked) { paso('bloqueo', 'sin_autorizacion'); alerta('#e-cv', 'Te falta un toque: marca la casilla de autorización y vuelve a tocar «Ver mi diagnóstico gratis».'); senalar($('#c-ok').closest('.check')); return; }
      var li = x.li_url.trim();
      if (li && !/linkedin\.com\/in\/[^\s]+/i.test(li)) { alerta('#e-cv', 'El enlace de LinkedIn debe verse como linkedin.com/in/tu-nombre.'); return; }
      if (config && config.turnstile && !tsToken) { paso('bloqueo', 'sin_captcha'); alerta('#e-cv', 'Te falta confirmar que no eres un robot: toca el recuadro de verificación, espera el visto bueno y vuelve a tocar «Ver mi diagnóstico gratis».'); senalar($('#ts-box')); return; }
      alerta('#e-cv', '');
      mostrar('cirugia');
      animarEtapas();
      track('cv_operar', { tipo: cv.tipo, linkedin_pdf: Boolean(liTexto) });
      var body = {
        form: { vacante: x.vacante, pais: ($('#f-pais') && $('#f-pais').value) || 'panama', pais_otro: ($('#f-pais-otro') && $('#f-pais-otro').value.trim()) || '' },
        linkedin: { url: li, texto: liTexto },
        cv: cv,
        consentimiento: { datos: true, ia: true, mayor: true },
        turnstile: tsToken,
        recordatorio: recordatorioToken()
      };
      api('/api/diagnostico', { method: 'POST', body: body }).then(function (r) {
        pararEtapas();
        etapas.forEach(function (li) { li.className = 'done'; });
        var ses = { id: r.id, key: r.key };
        store.set('ses', ses);
        track('cv_diagnostico', { puntaje: r.diagnostico.puntaje_global });
        if (!DEMO && window.mjPixel) window.mjPixel('Lead', { content_name: 'Diagnóstico gratis · CV en el Quirófano' }, 'lead-' + r.id);
        return wait(500).then(function () { verDiagnostico(ses, r.diagnostico, r.precio, r); });
      }).catch(function (e) {
        pararEtapas();
        mostrar('cv');
        var pend = e.code === 'ia' && e.data && e.data.pendiente;
        alerta('#e-cv', pend ? '' : e.message);
        if (pend) ofrecerCorreo(pend);
        if (window.turnstile) { try { window.turnstile.reset(); } catch (er) { /* nada */ } tsToken = null; }
      });
    });

    // La IA no pudo terminar en el momento: en vez de dejar a la persona con un error, se le ofrece
    // dejar su correo. El servidor reintenta solo y le manda el enlace a su diagnóstico cuando esté listo.
    function ofrecerCorreo(pend) {
      var viejo = $('#pend-box'); if (viejo) viejo.remove();
      var box = document.createElement('div');
      box.className = 'guardar'; box.id = 'pend-box';
      box.innerHTML = '<b>El quirófano está lleno en este momento.</b>' +
        '<p>Tu hoja de vida ya está en la fila. Déjame tu correo y te mando tu diagnóstico apenas esté listo, normalmente en unos minutos. Solo uso tu correo para esto.</p>' +
        '<div class="guardar-f"><input type="email" id="pend-correo" placeholder="tu@correo.com" autocomplete="email" inputmode="email" aria-label="Tu correo">' +
        '<button class="btn" type="button" id="pend-enviar">Envíamelo</button></div>' +
        '<p class="g-msg" id="pend-msg" hidden></p>' +
        '<p id="pend-otra" style="margin:10px 0 0;font-size:.85rem">¿Prefieres esperar aquí? Vuelve a tocar «Ver mi diagnóstico gratis» en un minuto.</p>';
      var e = $('#e-cv'); e.parentNode.insertBefore(box, e.nextSibling);
      var inp = $('#pend-correo'), btn = $('#pend-enviar'), msg = $('#pend-msg');
      var aviso = function (t, tipo) { msg.textContent = t; msg.className = 'g-msg ' + (tipo || ''); msg.hidden = !t; };
      track('cv_pendiente_ofrecido', {});
      btn.addEventListener('click', function () {
        var correo = (inp.value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { aviso('Escribe un correo válido, por ejemplo nombre@gmail.com.', 'err'); inp.focus(); return; }
        btn.disabled = true; aviso('');
        api('/api/diagnostico/pendiente', { method: 'POST', body: { id: pend.id, key: pend.key, correo: correo } }).then(function () {
          box.querySelector('.guardar-f').hidden = true; $('#pend-otra').hidden = true;
          aviso('Listo. Te llega a ' + correo + ' apenas esté listo. Si no lo ves, revisa en promociones o spam.', 'ok');
          track('cv_pendiente_correo', {});
          if (!DEMO && window.mjPixel) window.mjPixel('Lead', { content_name: 'Diagnóstico gratis por correo · CV en el Quirófano' }, 'lead-p-' + pend.id);
        }).catch(function (er) { aviso(er.message, 'err'); btn.disabled = false; });
      });
    }
    $('#operar').addEventListener('click', function () { var b = $('#pend-box'); if (b) b.remove(); }, true);

    // Diagnóstico y pago
    var diagActual = null;
    var diagPrecio = null;
    function verDiagnostico(ses, diag, precio, info) {
      var p = $('#p-diag');
      diagActual = diag;
      diagPrecio = precio;
      fijarOferta(info);
      $('#diag-body').innerHTML = renderDiagnostico(diag, precio);
      // Archivo de más de 10 páginas: el servidor revisó solo las primeras (nov. 2026).
      if (info && info.recorte && info.recorte.paginas) {
        var nota = document.createElement('p');
        nota.className = 'recorte-nota';
        nota.textContent = 'Tu archivo tenía ' + Number(info.recorte.paginas) + ' páginas: revisé las primeras ' + Number(info.recorte.revisadas || 10) + '. Si tu hoja de vida termina antes, no hace falta subir certificados ni anexos.';
        $('#diag-body').insertBefore(nota, $('#diag-body').firstChild);
      }
      animarRings(p);
      mostrar('diag');
      montarPago(ses, precio);
      montarGuardar(ses);
      medirInteres(ses);
      montarBarraCompra(ses, precio);
    }

    // Barra fija de compra en el celular (nov. 2026): 17 de 29 personas leían su diagnóstico y nunca llegaban al
    // bloque de pago. Aparece cuando ni el primer botón de compra ni el bloque de pago están a la vista.
    function montarBarraCompra(ses, precio) {
      var bar = $('#cta-fija');
      if (!bar) {
        bar = document.createElement('a');
        bar.id = 'cta-fija'; bar.className = 'cta-fija'; bar.href = '#pay'; bar.hidden = true;
        document.body.appendChild(bar);
      }
      bar.innerHTML = '<span>Quiero mi informe · ' + precioTxt(precio) + '</span> <span aria-hidden="true">→</span>';
      if (!bar.getAttribute('data-on')) {
        bar.setAttribute('data-on', '1');
        bar.addEventListener('click', function (e) {
          var pay = $('#pay');
          if (pay) { e.preventDefault(); try { pay.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch (er) { location.hash = 'pay'; } }
          if (bar._marcar) bar._marcar();
        });
      }
      if (!('IntersectionObserver' in window)) return;
      if (bar._io) bar._io.disconnect();
      var arriba = $('#diag-body .cta-buy'), pago = $('#pay'), visto = {};
      var ver = function () { bar.hidden = Boolean(visto.arriba || visto.pago) || $('#p-diag').hidden; };
      bar._io = new IntersectionObserver(function (es) {
        es.forEach(function (x) { visto[x.target === pago ? 'pago' : 'arriba'] = x.isIntersecting; });
        ver();
      }, { threshold: 0 });
      // Al principio el diagnóstico arranca arriba: la barra espera a que la persona baje.
      visto.arriba = true;
      if (arriba) bar._io.observe(arriba);
      if (pago) bar._io.observe(pago);
    }

    // Embudo después del diagnóstico: quién llega a ver el precio y quién toca «Quiero mi informe».
    // Se cuenta en el panel (sin cookies) y, si la persona aceptó las cookies de Meta, también en el píxel.
    function medirInteres(ses) {
      var hecho = {};
      function marcar(que, evMeta) {
        if (hecho[que] || DEMO) return;
        hecho[que] = true;
        api('/api/interes', { method: 'POST', body: { id: ses.id, key: ses.key, que: que } }).catch(function () { /* medir nunca rompe nada */ });
        if (window.mjPixel) window.mjPixel(evMeta, { content_name: 'Informe · CV en el Quirófano', value: Number(diagPrecio) || 0, currency: 'USD' }, que + '-' + ses.id);
      }
      Array.prototype.forEach.call(document.querySelectorAll('#diag-body .cta-big'), function (a) {
        a.addEventListener('click', function () { marcar('quiere', 'InitiateCheckout'); marcar('precio', 'ViewContent'); });
      });
      // La barra fija del celular cuenta igual que los botones (se conecta en montarBarraCompra).
      var barra = $('#cta-fija') || document.createElement('a');
      if (!barra.id) { barra.id = 'cta-fija'; barra.className = 'cta-fija'; barra.href = '#pay'; barra.hidden = true; document.body.appendChild(barra); }
      barra._marcar = function () { marcar('quiere', 'InitiateCheckout'); marcar('precio', 'ViewContent'); };
      // Cuenta apenas el precio del bloque de pago aparece en pantalla (el bloque completo puede ser más alto que un celular).
      var precioEl = $('#pay .price') || $('#pay');
      if (precioEl && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          if (es.some(function (x) { return x.isIntersecting; })) { marcar('precio', 'ViewContent'); io.disconnect(); }
        }, { threshold: 0.6 });
        io.observe(precioEl);
      }
    }

    // "Envíame mi diagnóstico por correo": opcional, un correo ahora y un aviso antes de que se borre.
    function montarGuardar(ses) {
      var btn = $('#g-enviar'), inp = $('#g-correo'), msg = $('#g-msg'), nov = $('#g-nov');
      if (!btn) return;
      var aviso = function (t, tipo) { msg.textContent = t; msg.className = 'g-msg ' + (tipo || ''); msg.hidden = !t; };
      btn.addEventListener('click', function () {
        var correo = (inp.value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { aviso('Escribe un correo válido, por ejemplo nombre@gmail.com.', 'err'); inp.focus(); return; }
        btn.disabled = true; aviso('');
        api('/api/diagnostico/guardar', { method: 'POST', body: { id: ses.id, key: ses.key, correo: correo, novedades: !!(nov && nov.checked), novedades_v: 2 } }).then(function () {
          $('#guardar').querySelector('.guardar-f').hidden = true; nov.closest('label').hidden = true;
          aviso('Listo. Te llegó a ' + correo + '. Si no lo ves, revisa en promociones o spam.', 'ok');
          track('GuardoDiagnostico', {});
        }).catch(function (e) { aviso(e.message, 'err'); btn.disabled = false; });
      });
    }

    var tPoll = null;
    function poll(ses, alPagar, alFallar, lim, cada) {
      clearInterval(tPoll);
      var hasta = Date.now() + (lim || 7 * 60 * 1000);
      tPoll = setInterval(function () {
        if (Date.now() > hasta) { clearInterval(tPoll); alFallar('No recibimos la confirmación de Yappy. Si ya pagaste, recarga esta página en un minuto. Si no, intenta de nuevo.'); return; }
        api('/api/estado', { query: { id: ses.id, key: ses.key } }).then(function (s) {
          if (s.pagado) { clearInterval(tPoll); alPagar(); return; }
          if (s.orden === 'rejected' || s.orden === 'cancelled' || s.orden === 'expired') {
            clearInterval(tPoll);
            alFallar({ rejected: 'El pago no se confirmó a tiempo. Tienes 5 minutos para aprobarlo en tu app.', cancelled: 'Cancelaste el pago en tu app de Yappy.', expired: 'La solicitud de pago venció.' }[s.orden] + ' Puedes intentar de nuevo.');
          }
        }).catch(function () { /* reintenta en el próximo ciclo */ });
      }, cada || 3000);
    }

    function montarPago(ses, precio) {
      var box = $('#pay-body');
      cargarConfig().then(function (c) {
        var local = precioLocal(c.pais || (DEMO && (location.search.match(/[?&]pais=([A-Z]{2})/) || [])[1]) || '', precio);
        Array.prototype.forEach.call(document.querySelectorAll('#diag-body .precio-local'), function (el) { el.textContent = local && !el.classList.contains('cta-local') ? local + ' Se cobra en dólares; tu banco hace la conversión.' : local; el.hidden = !local; });
        var demoPago = DEMO || c.demo_pago;
        var paypalOn = demoPago || Boolean(c.paypal && c.paypal.activo && c.paypal.client_id);
        // Yappy solo para quien entra desde Panamá (país que detecta Cloudflare). Afuera, solo PayPal.
        // Regla estricta (nov. 2026): el botón de Yappy aparece solo si Cloudflare detecta Panamá.
        var enPanama = demoPago || c.pais === 'PA';
        var yappyPermitido = C.yappy !== false; // interruptor en cvq-config.js
        var yappyOn = yappyPermitido && enPanama && (demoPago || Boolean(c.yappy && c.yappy.activo));
        var manualOn = yappyPermitido && enPanama && !yappyOn && Boolean(c.manual && c.manual.activo);
        if (!yappyOn && !paypalOn && !manualOn) {
          box.innerHTML = '<p>El pago en línea todavía no está activo. Escríbeme por WhatsApp y te envío tu informe.</p><a class="btn gold" href="https://wa.me/' + (C.whatsapp || '50763454868') + '?text=' + encodeURIComponent('Hola Miguel, hice mi diagnóstico de CV en el Quirófano y quiero el informe completo.') + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>';
          return;
        }
        var cargoInf = (diagActual && diagActual.cargo_objetivo_inferido) || '';
        var h = (cargoInf ? '<div class="field"><label for="cargo">Tu informe se enfoca en este cargo</label><input id="cargo" maxlength="120" value="' + esc(cargoInf) + '"><span class="hint">Lo deduje de tu CV. Si apuntas a otro, cámbialo antes de pagar.</span></div>' : '') +
          '<div class="field"><label for="mail">¿A qué correo te envío el informe?</label><input id="mail" type="email" inputmode="email" autocomplete="email" maxlength="200" placeholder="nombre.apellido@gmail.com"></div>';
        // Paso intermedio (nov. 2026): los botones de pago no aparecen hasta que la persona decide seguir.
        // Antes, con el correo y el número autocompletados, un toque sin querer al botón de Yappy enviaba la solicitud de cobro.
        h += '<div class="pay-gate" id="pay-gate"><button class="btn gold" type="button" id="pay-seguir">Continuar al pago</button><p class="fine-w">Todavía no se cobra nada. En el siguiente paso eliges cómo pagar.</p></div>';
        h += '<div class="pay-metodos" id="pay-metodos" hidden><div class="pay-resumen" id="pay-resumen"></div>';
        if (yappyOn) h += '<div class="paym" id="m-yappy"><div class="field"><label for="tel">Tu número de Yappy</label><input id="tel" inputmode="numeric" autocomplete="tel-national" maxlength="9" placeholder="6123-4567"><span class="hint">Al tocar el botón azul te llega una solicitud a tu app. Solo se cobra si tú la apruebas (tienes 5 minutos).</span></div><div class="yappy-slot" id="yslot"></div></div>';
        if (manualOn) h += '<div class="paym" id="m-manual"><p class="pp-t">Pagas ' + money(precio) + ' por Yappy.</p><button class="btn gold" type="button" id="manual-btn">Quiero mi informe</button></div>';
        if ((yappyOn || manualOn) && paypalOn) h += '<div class="or" role="separator"><span>¿Prefieres tarjeta o PayPal?</span></div>';
        if (paypalOn) h += '<div class="paym" id="m-paypal">' + '<p class="pp-t">Paga con tarjeta de crédito o débito, o con tu cuenta PayPal.</p><p class="fine-w" style="margin:-4px 0 10px">Para pagar con tarjeta no necesitas cuenta de PayPal: toca «Tarjeta de débito o crédito».</p>' + '<div class="pp-slot" id="ppslot"></div></div>';
        h += '</div>';
        h += '<details class="promo"><summary>¿Tienes un código de regalo?</summary><div class="promo-row"><input id="promo" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Código de regalo" placeholder="Escribe tu código"><button class="btn" type="button" id="promo-btn">Usar código</button></div></details>';
        h += '<div class="alert" id="e-pay" hidden></div><div id="pay-status" aria-live="polite"></div>';
        box.innerHTML = h;

        var tel = $('#tel');
        if (tel) tel.addEventListener('input', function () { var v = tel.value.replace(/\D/g, '').slice(0, 8); tel.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v; });
        function numero() { return tel ? tel.value.replace(/\D/g, '') : ''; }
        function correo() { return ($('#mail').value || '').trim(); }
        function cargo() { var x = $('#cargo'); return x ? x.value.trim() : ''; }
        function correoOk() {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo())) return true;
          alerta('#e-pay', 'Escribe tu correo: ahí te llega el informe.'); $('#mail').focus(); return false;
        }
        function numeroOk() {
          if (/^6\d{7}$/.test(numero())) return true;
          alerta('#e-pay', 'Escribe tu número de Yappy: 8 dígitos y empieza con 6.'); tel.focus(); return false;
        }
        function datosPago(extra) {
          var b = { id: ses.id, key: ses.key, email: correo(), cargo: cargo() };
          for (var k in extra) b[k] = extra[k];
          return { method: 'POST', body: b };
        }
        function esperando(metodo) {
          $('#pay-status').innerHTML = metodo === 'paypal'
            ? '<div class="wait-box"><span class="spinner"></span><b>Confirmando tu pago con PayPal</b><p>Un momento. Apenas PayPal lo confirme, empiezo a redactar tu informe.</p></div>'
            : '<div class="wait-box"><span class="spinner"></span><b>Confirma en tu app de Yappy</b><p>Te enviamos una solicitud de ' + money(precio) + ' al celular terminado en ' + esc(numero().slice(-2)) + '. Apenas la apruebes, empiezo a redactar tu informe.</p></div>';
        }
        function fallo(msg) { $('#pay-status').innerHTML = ''; alerta('#e-pay', msg); }
        function pagado(gratis) {
          track('cv_pago_ok');
          if (gratis !== true && !DEMO && window.mjPixel) window.mjPixel('Purchase', { value: Number(precio) || 0, currency: 'USD', content_name: 'Informe · CV en el Quirófano' }, 'buy-' + ses.id);
          redactar(ses);
        }
        function enRevision() {
          $('#pay-status').innerHTML = '<div class="wait-box"><span class="spinner"></span><b>PayPal está revisando tu pago</b><p>A veces tarda unos minutos. Apenas lo apruebe, empiezo a redactar tu informe y te llega a tu correo. Puedes dejar esta pantalla abierta.</p></div>';
          poll(ses, pagado, function () { fallo('PayPal todavía no aprueba tu pago. Cuando lo haga, te llega el informe a tu correo.'); }, 30 * 60 * 1000);
        }

        // Código de regalo (o el código maestro de Miguel): el informe sale sin cobro.
        var pbtn = $('#promo-btn');
        if (pbtn) pbtn.addEventListener('click', function () {
          var cod = ($('#promo').value || '').trim();
          if (!cod) { alerta('#e-pay', 'Escribe tu código.'); $('#promo').focus(); return; }
          if (!correoOk()) return;
          pbtn.disabled = true; alerta('#e-pay', ''); track('cv_pago_click', { metodo: 'codigo' });
          api('/api/pago/codigo', datosPago({ codigo: cod })).then(function () { pagado(true); })
            .catch(function (e) { pbtn.disabled = false; fallo(e.message); });
        });

        var metodosListos = false;
        function abrirMetodos(auto) {
          if (!auto && !correoOk()) return;
          alerta('#e-pay', '');
          $('#pay-gate').hidden = true;
          $('#pay-metodos').hidden = false;
          $('#pay-resumen').innerHTML = auto ? '' : '<p><b>Tu informe completo: ' + money(precio) + '</b>, pago único.' + (cargo() ? ' Enfocado en ' + esc(cargo()) + '.' : '') + ' Te llega a <b>' + esc(correo()) + '</b>. <button class="pay-cambiar" type="button" id="pay-cambiar">Cambiar</button></p>';
          var cb = $('#pay-cambiar');
          if (cb) cb.addEventListener('click', function () { $('#pay-metodos').hidden = true; $('#pay-gate').hidden = false; $('#mail').focus(); });
          if (!auto) { track('cv_pago_continuar'); $('#pay-metodos').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          if (metodosListos) return;
          metodosListos = true;
          montarMetodos();
        }
        $('#pay-seguir').addEventListener('click', function () { abrirMetodos(false); });
        // Quien ya pidió su código de pago manual vuelve directo a ver sus instrucciones.
        if (manualOn && store.get('manual') && store.get('manual').id === ses.id) abrirMetodos(true);

        function montarMetodos() {
          // Pago manual: Yappy directo a Miguel, que lo confirma desde su panel.
          if (manualOn) {
            var wa = C.whatsapp || '50763454868';
            var verCodigo = function (codigo) {
              var yappy = c.manual.yappy;
              var texto = 'Hola Miguel, ya pagué mi informe de CV en el Quirófano. Mi código es ' + codigo + '.';
              $('#m-manual').innerHTML = '<div class="manual-ok"><span class="label" style="color:#A9B6CB">Tu código</span><div class="code">' + esc(codigo) + '</div>' +
                '<ol><li>' + (yappy ? 'Envía <b>' + money(precio) + '</b> por Yappy a <b>' + esc(yappy) + '</b>.' : 'Escríbeme por WhatsApp y te paso el Yappy para enviar <b>' + money(precio) + '</b>.') + '</li>' +
                '<li>Mándame el comprobante por WhatsApp con tu código.</li></ol>' +
                '<a class="btn gold" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(texto) + '" target="_blank" rel="noopener">Enviar comprobante por WhatsApp</a>' +
                '<p class="fine-w">Apenas confirme tu pago, tu informe aparece en esta pantalla y te llega a tu correo. Si cierras esta página, igual te llega.</p></div>';
              $('#pay-status').innerHTML = '<div class="wait-box"><span class="spinner"></span><b>Esperando la confirmación de tu pago</b></div>';
              poll(ses, pagado, function () { $('#pay-status').innerHTML = ''; }, 3 * 24 * 3600 * 1000, 15000);
            };
            var previoManual = store.get('manual');
            if (previoManual && previoManual.id === ses.id) verCodigo(previoManual.codigo);
            else $('#manual-btn').addEventListener('click', function () {
              if (!correoOk()) return;
              var btn = $('#manual-btn'); btn.disabled = true;
              alerta('#e-pay', ''); track('cv_pago_click', { metodo: 'manual' });
              api('/api/pago/manual', datosPago({})).then(function (r) {
                store.set('manual', { id: ses.id, codigo: r.codigo });
                verCodigo(r.codigo);
              }).catch(function (e) { btn.disabled = false; fallo(e.message); });
            });
            // Sin return: si PayPal está activo, su botón se monta abajo (antes quedaba el título sin botón).
          }

          // Pago simulado (modo demostración o servicio en pruebas)
          if (demoPago) {
            var botones = [];
            var simular = function (btn, metodo) {
              botones.push(btn);
              btn.addEventListener('click', function () {
                if (!correoOk()) return;
                if (metodo === 'yappy' && !numeroOk()) return;
                alerta('#e-pay', ''); botones.forEach(function (x) { x.disabled = true; }); track('cv_pago_click', { metodo: metodo });
                var libre = function () { botones.forEach(function (x) { x.disabled = false; }); };
                var orden;
                api(metodo === 'paypal' ? '/api/paypal/crear' : '/api/pago/crear', datosPago(metodo === 'yappy' ? { telefono: numero() } : {}))
                  .then(function (r) {
                    orden = r;
                    esperando(metodo);
                    var sim = metodo === 'paypal' ? window.CVQ_simPayPal : window.CVQ_simYappy;
                    return sim ? sim(metodo === 'paypal' ? correo() : numero(), precio) : true;
                  })
                  .then(function (aprobado) {
                    if (!aprobado) { libre(); fallo(metodo === 'paypal' ? 'Cancelaste el pago en PayPal. Puedes intentarlo de nuevo.' : 'El pago no se aprobó en la app. Puedes intentarlo de nuevo.'); return; }
                    if (metodo === 'paypal') return api('/api/paypal/capturar', datosPago({ paypal_id: orden.paypal_id })).then(pagado);
                    return api('/api/pago/demo', { method: 'POST', body: { id: ses.id, key: ses.key } }).then(pagado);
                  })
                  .catch(function (e) { libre(); fallo(e.message); });
              });
            };
            var nuevoBoton = function (clase, texto, slot) { var b = d.createElement('button'); b.className = clase; b.type = 'button'; b.textContent = texto; $(slot).appendChild(b); return b; };
            if (yappyOn) simular(nuevoBoton('ybtn', 'Pagar ' + money(precio) + ' con Yappy', '#yslot'), 'yappy');
            if (paypalOn) simular(nuevoBoton('ppbtn', 'Pagar ' + money(precio) + ' con PayPal', '#ppslot'), 'paypal');
            $('#pay-status').insertAdjacentHTML('beforebegin', '<p class="fine-w">Pago simulado. En la web real aquí aparecen los botones oficiales de Yappy y PayPal, y el cobro es de verdad.</p>');
            return;
          }

          // Yappy
          if (yappyOn) {
            loadScript(c.yappy.cdn, true).then(function () {
              var btn = d.createElement('btn-yappy');
              btn.setAttribute('theme', 'blue');
              btn.setAttribute('rounded', 'true');
              $('#yslot').appendChild(btn);
              btn.addEventListener('isYappyOnline', function (e) {
                if (e && e.detail === false) alerta('#e-pay', 'Yappy no está disponible en este momento. Intenta en unos minutos' + (paypalOn ? ' o paga con PayPal.' : ' o escríbeme por WhatsApp.'));
              });
              btn.addEventListener('eventClick', function () {
                if (!correoOk() || !numeroOk()) return;
                alerta('#e-pay', '');
                track('cv_pago_click', { metodo: 'yappy' });
                btn.isButtonLoading = true;
                api('/api/pago/crear', datosPago({ telefono: numero() })).then(function (r) {
                  btn.eventPayment({ transactionId: r.transactionId, documentName: r.documentName, token: r.token });
                  btn.isButtonLoading = false;
                  esperando('yappy');
                  poll(ses, pagado, fallo);
                }).catch(function (e) { btn.isButtonLoading = false; fallo(e.message); });
              });
              btn.addEventListener('eventSuccess', function () { esperando('yappy'); poll(ses, pagado, fallo, 90 * 1000); });
              btn.addEventListener('eventError', function () { /* el estado real llega por el IPN: el sondeo decide */ });
            }).catch(function () {
              alerta('#e-pay', 'No pudimos cargar el botón de Yappy. Revisa tu conexión y recarga la página.');
            });
          }

          // PayPal: el navegador solo aprueba; el servicio captura y verifica el cobro.
          if (paypalOn) {
            var sdk = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(c.paypal.client_id) + '&currency=USD&intent=capture&components=buttons&disable-funding=paylater,venmo';
            loadScript(sdk).then(function () {
              var ultimoError = '';
              window.paypal.Buttons({
                style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay', height: 48 },
                onClick: function (data, actions) {
                  if (!correoOk()) return actions.reject();
                  alerta('#e-pay', ''); ultimoError = '';
                  track('cv_pago_click', { metodo: 'paypal' });
                  return actions.resolve();
                },
                createOrder: function () {
                  return api('/api/paypal/crear', datosPago({})).then(function (r) { return r.paypal_id; })
                    .catch(function (e) { ultimoError = e.message; throw e; });
                },
                onApprove: function (data, actions) {
                  esperando('paypal');
                  return api('/api/paypal/capturar', datosPago({ paypal_id: data.orderID })).then(function (r) {
                    if (r.pendiente) { enRevision(); return; }
                    pagado();
                  }).catch(function (e) {
                    if (e.code === 'paypal_declinado') { fallo(e.message); return actions.restart(); }
                    fallo(e.message);
                  });
                },
                onCancel: function () { fallo('Cancelaste el pago en PayPal. Puedes intentarlo de nuevo cuando quieras.'); },
                onError: function () { fallo(ultimoError || ('PayPal no pudo procesar el pago. Intenta de nuevo' + (yappyOn ? ' o paga con Yappy.' : '.'))); }
              }).render('#ppslot');
            }).catch(function () {
              $('#ppslot').innerHTML = '<p class="fine-w">No pudimos cargar PayPal. Revisa tu conexión' + (yappyOn ? ' o paga con Yappy.' : ' y recarga la página.') + '</p>';
            });
          }
        }
      });
    }

    // Redacción del informe
    function redactar(ses) {
      clearInterval(tPoll);
      mostrar('redactando');
      var barra = $('#rprog');
      // Avance por tiempo: la barra y los pasos se mueven siempre, aunque la IA todavía no haya escrito texto.
      var t0 = Date.now(), porTexto = 0;
      var PASOS = ['Leyendo tu hoja de vida línea por línea…', 'Pasando cada línea por las reglas del método…', 'Reescribiendo tus logros con la fórmula V·Q·L·P…', 'Revisando zona roja y palabras clave de tu país…', 'Armando tu CV en formato Harvard…', 'Preparando tu LinkedIn y tus preguntas de entrevista…', 'Últimos puntos de sutura: revisando todo antes de entregarlo…'];
      var pintarAvance = function () {
        var s = (Date.now() - t0) / 1000;
        var porTiempo = 92 * (1 - Math.exp(-s / 150));
        barra.style.setProperty('--p', Math.max(6, Math.min(96, Math.max(porTiempo, porTexto))) + '%');
        var paso = $('#rpaso'); if (paso) paso.textContent = PASOS[Math.min(PASOS.length - 1, Math.floor(s / 45))];
      };
      pintarAvance();
      var tAvance = setInterval(pintarAvance, 1000);
      var esperarListo = function (limite) {
        // Sondea hasta que el servidor tenga el informe (lo termina solo aunque se corte esta conexión).
        return new Promise(function (ok, ko) {
          var n = 0;
          var t = setInterval(function () {
            n++;
            api('/api/informe', { query: { id: ses.id, key: ses.key } }).then(function (r) {
              if (r.listo) { clearInterval(t); ok(r.informe); }
              else if (n > limite) { clearInterval(t); ko(new Error('Tu informe está tardando más de lo normal. Te llegará a tu correo apenas esté; no tienes que hacer nada.')); }
            }).catch(function () { /* sigue */ });
          }, 5000);
        });
      };
      pedirInforme(ses, function (chars) { porTexto = Math.min(96, 6 + chars / 450); pintarAvance(); })
        .catch(function () { return esperarListo(240); })
        .then(function (inf) {
          if (inf) return inf;
          // Otro proceso lo está redactando: esperamos a que esté listo.
          return new Promise(function (ok, ko) {
            var n = 0;
            var t = setInterval(function () {
              n++;
              api('/api/informe', { query: { id: ses.id, key: ses.key } }).then(function (r) {
                if (r.listo) { clearInterval(t); ok(r.informe); }
                else if (n > 120) { clearInterval(t); ko(new Error('Tu informe está tardando más de lo normal. Te llegará al correo.')); }
              }).catch(function () { /* sigue */ });
            }, 5000);
          });
        })
        .then(function (inf) { clearInterval(tAvance); barra.style.setProperty('--p', '100%'); track('cv_informe'); verInforme(ses, inf); })
        .catch(function (e) {
          clearInterval(tAvance);
          $('#r-err').hidden = false;
          $('#r-err').innerHTML = esc(e.message) + ' <a href="#" id="r-retry">Reintentar ahora</a>';
          $('#r-retry').addEventListener('click', function (ev) { ev.preventDefault(); $('#r-err').hidden = true; redactar(ses); });
        });
    }

    function verInforme(ses, inf) {
      var c = $('#informe-body');
      c.innerHTML = renderInforme(inf, ses);
      animarRings(c);
      mostrar('informe');
      if (!c.getAttribute('data-on')) { conectarInforme(c, ses); c.setAttribute('data-on', '1'); }
    }

    // Retomar una revisión en curso
    $$('[data-reiniciar]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); store.del('ses'); store.del('demo'); store.del('manual'); location.reload(); }); });
    var ses = store.get('ses');
    if (!ses) { mostrar('cv'); return; }
    api('/api/estado', { query: { id: ses.id, key: ses.key } }).then(function (s) {
      if (s.listo) return api('/api/informe', { query: { id: ses.id, key: ses.key } }).then(function (r) { verInforme(ses, r.informe); });
      if (s.pagado) return redactar(ses);
      verDiagnostico(ses, s.diagnostico, s.precio, s);
    }).catch(function () { store.del('ses'); mostrar('cv'); });
  }

  /* ---------- página del informe (enlace del correo) ---------- */
  function appInforme() {
    var c = $('#informe-body');
    if (/[?&]ejemplo=1/.test(location.search) || location.hash === '#ejemplo') {
      $('#demo-flag').hidden = false; $('#ejemplo-cta').hidden = false;
      loadScript(ASSETS + 'cvq-demo.js').then(function () {
        var s = { id: 'demo', key: 'demo', ejemplo: true };
        c.innerHTML = renderInforme(window.CVQ_DEMO.informe, s); animarRings(c); conectarInforme(c, s);
      });
      return;
    }
    if (DEMO) $('#demo-flag').hidden = false;
    var h = (location.hash || '').replace('#', '').split('.');
    var ses = h.length === 2 && h[0] ? { id: h[0], key: h[1] } : store.get('ses');
    if (DEMO && !ses) ses = { id: 'demo', key: 'demo' };
    if (!ses) { c.innerHTML = '<div class="panel"><h2>No encontré tu informe.<span class="soft">Abre el enlace que te llegó al correo.</span></h2><p class="sub">Los informes se borran a los 7 días. Si necesitas ayuda, escríbeme por WhatsApp.</p></div>'; return; }
    function pintar(inf) { c.innerHTML = renderInforme(inf, ses); animarRings(c); conectarInforme(c, ses); }
    if (DEMO) { demoData().then(function () { pintar(window.CVQ_DEMO.informe); }); return; }
    api('/api/informe', { query: { id: ses.id, key: ses.key } }).then(function (r) {
      if (r.listo) return pintar(r.informe);
      if (r.status === 'diagnosed') { store.set('ses', ses); location.href = '../revisar/'; return; }
      c.innerHTML = '<div class="panel surgery"><h2>Redactando tu informe.<span class="soft">Normalmente, de 2 a 5 minutos.</span></h2><div class="progress"><i id="rprog"></i></div></div>';
      return pedirInforme(ses, function (ch) { var b = $('#rprog'); if (b) b.style.setProperty('--p', Math.min(96, 6 + ch / 450) + '%'); }).then(function (inf) {
        if (inf) pintar(inf); else setTimeout(function () { location.reload(); }, 8000);
      });
    }).catch(function (e) {
      c.innerHTML = '<div class="panel"><h2>No pude abrir tu informe.<span class="soft">' + esc(e.message) + '</span></h2><p class="sub">Los informes se borran a los 7 días. Si crees que es un error, escríbeme por WhatsApp al +507 6345-4868.</p></div>';
    });
  }

  if (MODO === 'revisar') appRevisar();
  if (MODO === 'informe') appInforme();
  window.CVQ_render = { informe: renderInforme, diagnostico: renderDiagnostico };
})();
