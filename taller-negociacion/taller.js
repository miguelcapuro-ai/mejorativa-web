/* Taller de Negociación Inteligente (19 dic 2026): inscripción y pago por Yappy.
   Página aislada: no depende de site.js ni de los scripts del Doctor de CV. */
(function () {
  'use strict';
  var d = document;
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // En mejorativa.com siempre habla con el servicio real. Solo en una prueba local se puede apuntar a otro.
  var API = (local && new URLSearchParams(location.search).get('api')) || 'https://panel.mejorativa.com';
  var WA = 'https://wa.me/50763454868';
  var KEY = 'tn19_sesion';
  var $ = function (id) { return d.getElementById(id); };
  var ses = null, cfg = null, tsToken = null, tsId = null, sondeo = null;

  function ver(id, si) { $(id).hidden = !si; }
  function error(id, t) { $(id).textContent = t || ''; }
  function guardar(v) { try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento: sigue en memoria */ } }
  function leer() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function pixel(ev, datos, id) { try { if (window.mjPixel) window.mjPixel(ev, datos, id); } catch (e) { /* nada */ } }

  function api(ruta, cuerpo) {
    var op = cuerpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) } : {};
    return fetch(API + ruta, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.ok === false) { var e = new Error(j.mensaje || 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.'); e.code = j.error; throw e; }
        return j;
      });
    }, function () { throw new Error('No pudimos conectar. Revisa tu conexión e intenta de nuevo.'); });
  }
  function script(src, modulo) {
    return new Promise(function (ok, mal) {
      var s = d.createElement('script'); s.src = src; if (modulo) s.type = 'module'; s.async = true;
      s.onload = ok; s.onerror = mal; d.head.appendChild(s);
    });
  }
  function mensaje(html) { ver('tn-cargando', false); ver('tn-f1', false); ver('tn-f2', false); $('tn-msg').innerHTML = html; ver('tn-msg', true); }
  var enlaceWA = function (texto) { return '<a href="' + WA + '?text=' + encodeURIComponent(texto) + '" rel="noopener">Escríbeme por WhatsApp</a>'; };

  // ---------- Paso 1 ----------
  function paso1() {
    ver('tn-cargando', false); ver('tn-f2', false); ver('tn-msg', false); ver('tn-f1', true);
    if (cfg.agotado) $('tn-b1').textContent = 'Avísame si se libera un cupo';
    if (cfg.turnstile && tsId === null) {
      window.tnTsListo = function () {
        tsId = window.turnstile.render('#tn-ts', { sitekey: cfg.turnstile, language: 'es', callback: function (t) { tsToken = t; error('tn-e1', ''); }, 'expired-callback': function () { tsToken = null; } });
      };
      script('https://challenges.cloudflare.com/turnstile/v0/api.js?onload=tnTsListo&render=explicit').catch(function () {
        error('tn-e1', 'No cargó la verificación anti-robots. Recarga la página.');
      });
    }
  }
  $('tn-f1').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var nombre = $('tn-nombre').value.trim(), correo = $('tn-correo').value.trim();
    if (nombre.length < 2) { error('tn-e1', 'Escribe tu nombre, así sale en tu certificado.'); $('tn-nombre').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { error('tn-e1', 'Revisa tu correo: ahí te llega la confirmación.'); $('tn-correo').focus(); return; }
    if (cfg.turnstile && !tsToken) { error('tn-e1', 'Te falta la verificación: espera el visto bueno del recuadro y vuelve a tocar el botón.'); return; }
    error('tn-e1', ''); $('tn-b1').disabled = true;
    api('/taller/api/interes', { nombre: nombre, correo: correo, novedades: $('tn-nov').checked, turnstile: tsToken }).then(function (r) {
      ses = { id: r.id, key: r.key, nombre: nombre }; guardar(ses);
      pixel('Lead', { content_name: 'Taller de Negociación Inteligente 19 dic' }, 'tn19-lead-' + r.id);
      if (r.agotado || cfg.agotado) { guardar(null); mensaje('<b>Los 14 cupos ya se llenaron.</b> Tengo tus datos, ' + esc(nombre.split(' ')[0]) + ': si se libera uno, te escribo.'); return; }
      paso2();
    }).catch(function (e) {
      $('tn-b1').disabled = false; error('tn-e1', e.message);
      if (window.turnstile && tsId !== null) { try { window.turnstile.reset(tsId); } catch (x) { /* nada */ } tsToken = null; }
    });
  });
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- Paso 2 ----------
  function telefono() { return $('tn-tel').value.replace(/\D/g, '').replace(/^507/, ''); }
  $('tn-tel').addEventListener('input', function () {
    var n = this.value.replace(/\D/g, '').slice(0, 8);
    this.value = n.length > 4 ? n.slice(0, 4) + '-' + n.slice(4) : n;
  });
  function paso2() {
    ver('tn-cargando', false); ver('tn-f1', false); ver('tn-msg', false); ver('tn-f2', true);
    $('tn-hola').textContent = 'Listo, ' + ses.nombre.split(' ')[0] + '. Falta el pago y tu cupo queda confirmado.';
    if (!cfg.yappy) { $('tn-yslot').innerHTML = '<p class="tn-note">El pago por Yappy no está disponible en este momento. ' + enlaceWA('Hola Miguel, quiero pagar mi cupo del taller del 19 de diciembre.') + ' y lo resolvemos.</p>'; return; }
    if ($('tn-yslot').firstChild) return;
    script(cfg.yappy.cdn, true).then(function () {
      var btn = d.createElement('btn-yappy');
      btn.setAttribute('theme', 'blue'); btn.setAttribute('rounded', 'true');
      $('tn-yslot').appendChild(btn);
      btn.addEventListener('isYappyOnline', function (e) { if (e && e.detail === false) error('tn-e2', 'Yappy no está disponible en este momento. Intenta en unos minutos.'); });
      btn.addEventListener('eventClick', function () {
        if (!/^6\d{7}$/.test(telefono())) { error('tn-e2', 'Escribe tu número de celular de Yappy: 8 dígitos, empieza con 6.'); $('tn-tel').focus(); return; }
        error('tn-e2', ''); btn.isButtonLoading = true;
        pixel('InitiateCheckout', { value: cfg.precio, currency: 'USD' });
        api('/taller/api/yappy/crear', { id: ses.id, key: ses.key, telefono: telefono() }).then(function (r) {
          btn.eventPayment({ transactionId: r.transactionId, documentName: r.documentName, token: r.token });
          btn.isButtonLoading = false;
          esperar();
        }).catch(function (e) {
          btn.isButtonLoading = false;
          if (e.code === 'pagado') return revisar();
          if (e.code === 'sesion') { guardar(null); ses = null; paso1(); error('tn-e1', e.message); return; }
          error('tn-e2', e.message);
        });
      });
      btn.addEventListener('eventSuccess', esperar);
      btn.addEventListener('eventError', function () { /* el estado real lo dice el servidor: el sondeo decide */ });
    }).catch(function () { error('tn-e2', 'No pudimos cargar el botón de Yappy. Revisa tu conexión y recarga la página.'); });
  }

  // ---------- Confirmación ----------
  function revisar() {
    return api('/taller/api/estado?id=' + encodeURIComponent(ses.id) + '&key=' + encodeURIComponent(ses.key)).then(function (r) {
      if (r.pagado) { pagado(r); return true; }
      if (r.yappy === 'cancelled' || r.yappy === 'rejected' || r.yappy === 'expired') {
        parar(); ver('tn-wait', false);
        error('tn-e2', r.yappy === 'expired' ? 'La solicitud de pago venció. Toca el botón de Yappy para enviar otra.' : 'El pago no se aprobó en Yappy. Puedes tocar el botón e intentarlo de nuevo.');
      }
      return false;
    });
  }
  function parar() { if (sondeo) { clearInterval(sondeo); sondeo = null; } }
  function esperar() {
    ver('tn-wait', true); parar();
    var fin = Date.now() + 8 * 60 * 1000;
    sondeo = setInterval(function () {
      if (Date.now() > fin) { parar(); ver('tn-wait', false); error('tn-e2', 'Todavía no vemos tu pago. Si ya lo aprobaste en Yappy, recarga esta página en un minuto: tu cupo no se pierde.'); return; }
      revisar().catch(function () { /* se reintenta en la siguiente vuelta */ });
    }, 3000);
  }
  function pagado(r) {
    parar();
    ver('tn-cargando', false); ver('tn-f1', false); ver('tn-f2', false); ver('tn-msg', false); ver('tn-left', false); ver('tn-ok', true);
    if (r && r.confirmacion) $('tn-conf').textContent = 'Confirmación de Yappy: ' + r.confirmacion;
    $('tn-ok').focus();
    pixel('Purchase', { value: cfg ? cfg.precio : 80, currency: 'USD', content_name: 'Taller de Negociación Inteligente 19 dic' }, 'tn19-pago-' + ses.id);
  }

  // ---------- Arranque ----------
  api('/taller/api/config').then(function (c) {
    cfg = c;
    if (!c.abierto) { mensaje('<b>La inscripción a este taller ya cerró.</b> Para enterarte de la próxima fecha, ' + enlaceWA('Hola Miguel, quiero saber la próxima fecha del taller de negociación.') + '.'); return; }
    if (c.quedan !== null && c.quedan > 0) { $('tn-left').textContent = c.quedan === 1 ? 'Queda 1 cupo.' : 'Quedan ' + c.quedan + ' cupos.'; ver('tn-left', true); }
    if (c.agotado) { $('tn-left').textContent = 'Los 14 cupos ya se llenaron.'; ver('tn-left', true); }
    ses = leer();
    if (!ses) return paso1();
    // Volvió a la página con una inscripción en curso: si ya pagó, se le muestra; si no, sigue en el pago.
    revisar().then(function (ya) { if (!ya) { if (c.agotado) { guardar(null); ses = null; paso1(); } else paso2(); } })
      .catch(function () { guardar(null); ses = null; paso1(); });
  }).catch(function () {
    mensaje('No pudimos cargar la inscripción. Recarga la página o ' + enlaceWA('Hola Miguel, quiero inscribirme al taller del 19 de diciembre.').replace('Escríbeme', 'escríbeme') + '.');
  });
})();
