// Reproductor del testimonio en audio (CV en el Quirófano)
// Medición (Umami, sin cookies):
//   testimonio_play       alguien le dio play (una vez por visita)
//   testimonio_completo   lo escuchó hasta el final
//   testimonio_cta        tocó "Operar mi CV" en la franja del testimonio
//   cta_tras_testimonio   tocó cualquier botón de "Operar/Subir mi CV" después de escucharlo
(function () {
  function track(ev, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(ev, data || {}); } catch (e) {} }
  var escucho = false;

  document.querySelectorAll('.tplayer').forEach(function (fig) {
    var audio = fig.querySelector('audio');
    var btn = fig.querySelector('.tp-btn');
    var wave = fig.querySelector('.tp-wave');
    var cur = fig.querySelector('.tp-cur');
    var quien = fig.getAttribute('data-quien') || '';
    var dur = Number(fig.getAttribute('data-dur')) || 30;
    var peaks = (fig.getAttribute('data-peaks') || '').split(',').map(Number).filter(function (n) { return n > 0; });
    var bars = peaks.map(function (p) {
      var i = document.createElement('i');
      i.style.height = Math.max(10, p) + '%';
      wave.appendChild(i);
      return i;
    });
    function total() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : dur; }
    function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function paint() {
      var d = total();
      var lit = Math.round(Math.min(1, (audio.currentTime || 0) / d) * bars.length);
      for (var k = 0; k < bars.length; k++) bars[k].classList.toggle('on', k < lit);
      cur.textContent = fmt(audio.currentTime);
      wave.setAttribute('aria-valuenow', Math.round(audio.currentTime));
      wave.setAttribute('aria-valuetext', fmt(audio.currentTime) + ' de ' + fmt(d));
    }
    function seek(r) {
      try { audio.currentTime = Math.max(0, Math.min(total(), r * total())); } catch (e) {}
      paint();
    }
    btn.addEventListener('click', function () {
      if (audio.paused) {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      } else audio.pause();
    });
    audio.addEventListener('play', function () {
      fig.classList.add('is-playing');
      btn.setAttribute('aria-label', 'Pausar el testimonio');
      if (!fig._tracked) { fig._tracked = true; escucho = true; track('testimonio_play', { quien: quien, pagina: location.pathname }); }
    });
    audio.addEventListener('pause', function () { fig.classList.remove('is-playing'); btn.setAttribute('aria-label', 'Escuchar el testimonio'); });
    audio.addEventListener('ended', function () {
      if (!fig._completo) { fig._completo = true; track('testimonio_completo', { quien: quien }); }
      audio.currentTime = 0; paint();
    });
    audio.addEventListener('timeupdate', paint);
    wave.addEventListener('pointerdown', function (e) {
      var rect = wave.getBoundingClientRect();
      if (audio.readyState < 1) audio.load();
      seek((e.clientX - rect.left) / rect.width);
      try { wave.setPointerCapture(e.pointerId); } catch (x) {}
    });
    wave.addEventListener('pointermove', function (e) {
      if (!wave.hasPointerCapture || !wave.hasPointerCapture(e.pointerId)) return;
      var rect = wave.getBoundingClientRect();
      seek((e.clientX - rect.left) / rect.width);
    });
    wave.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { seek((audio.currentTime + 5) / total()); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { seek((audio.currentTime - 5) / total()); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { btn.click(); e.preventDefault(); }
    });
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.getAttribute('href').indexOf('revisar') === -1) return;
    var donde = a.getAttribute('data-where') || '';
    if (donde === 'cvq-testimonio') track('testimonio_cta', { escucho: escucho });
    if (escucho) track('cta_tras_testimonio', { ubicacion: donde });
  });
})();
