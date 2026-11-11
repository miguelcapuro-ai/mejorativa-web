/* Medición de anuncios de Meta (píxel), solo con consentimiento.
   - Nada se carga ni se guarda en cookies hasta que la persona pulsa "Acepto".
   - Un solo píxel para todo mejorativa.com: 2049626552404117 ("Mejorativa · Web").
   - window.mjPixel(evento, datos, idEvento): envía el evento una sola vez por idEvento
     (evita compras o leads duplicados si la página se recarga o el pago se confirma dos veces). */
(function () {
  var PIXEL = '2049626552404117';
  var KEY = 'mj_consent_meta';
  var cargado = false;
  var d = document;

  function leer() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function guardar(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* nada */ } }
  function yaEnviado(id) { try { return localStorage.getItem('mj_px_' + id) === '1'; } catch (e) { return false; } }
  function marcar(id) { try { localStorage.setItem('mj_px_' + id, '1'); } catch (e) { /* nada */ } }

  /* Enlaces con llave de acceso (…/informe/#id.llave): ahí el píxel no se carga,
     para que la dirección con la llave no salga del sitio. */
  function conLlave() { return /^#[a-z0-9]{20}\.[A-Za-z0-9_-]{16,}$/.test(location.hash || ''); }

  function cargar() {
    if (conLlave()) return;
    if (cargado || window.fbq) { cargado = true; return; }
    cargado = true;
    /* Código base oficial del píxel de Meta */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, d, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL);
    window.fbq('track', 'PageView');
  }

  window.mjPixel = function (ev, datos, id) {
    if (leer() !== 'si') return;
    if (id && yaEnviado(id)) return;
    if (conLlave()) return;
    cargar();
    try { window.fbq('track', ev, datos || {}, id ? { eventID: id } : undefined); } catch (e) { /* nada */ }
    if (id) marcar(id);
  };

  function aviso() {
    var css = d.createElement('style');
    css.textContent =
      '.mj-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;background:#fff;border:2px solid #13305A;border-radius:18px;box-shadow:0 12px 40px rgba(11,31,58,.22);padding:16px 18px;font-family:inherit;font-size:15px;line-height:1.45;color:#26303F}' +
      '.mj-cc p{margin:0 0 12px}.mj-cc a{color:#1F4E80;text-decoration:underline}' +
      '.mj-cc .b{display:flex;gap:10px;flex-wrap:wrap}.mj-cc button{flex:1;min-width:120px;border-radius:12px;padding:11px 14px;font-family:inherit;font-weight:700;font-size:15px;line-height:1;cursor:pointer}' +
      '.mj-cc .si{background:#13305A;color:#fff;border:2px solid #13305A}.mj-cc .no{background:#fff;color:#13305A;border:2px solid #C3CCDA}';
    d.head.appendChild(css);
    var box = d.createElement('div');
    box.className = 'mj-cc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookies de Meta');
    box.innerHTML = '<p>¿Nos dejas usar cookies de Meta para saber si nuestros anuncios te sirven? Solo se activan si aceptas. <a href="/cookies/">Más información</a>.</p>' +
      '<div class="b"><button type="button" class="si">Acepto</button><button type="button" class="no">No, gracias</button></div>';
    d.body.appendChild(box);
    box.querySelector('.si').addEventListener('click', function () { guardar('si'); box.remove(); cargar(); });
    box.querySelector('.no').addEventListener('click', function () { guardar('no'); box.remove(); });
  }

  /* Enlace "Cambiar mis preferencias de cookies" en la política de cookies */
  window.mjCookiesReset = function () { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } location.reload(); };

  function iniciar() {
    var v = leer();
    if (v === 'si') cargar();
    else if (v !== 'no' && !conLlave()) aviso();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
