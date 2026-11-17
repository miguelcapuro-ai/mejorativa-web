// Reproductor del testimonio en audio (CV en el Quirófano)
(function () {
  document.querySelectorAll('.tplayer').forEach(function (fig) {
    var audio = fig.querySelector('audio');
    var btn = fig.querySelector('.tp-btn');
    var wave = fig.querySelector('.tp-wave');
    var cur = fig.querySelector('.tp-cur');
    var peaks = (fig.getAttribute('data-peaks') || '').split(',').map(Number).filter(function (n) { return n > 0; });
    var bars = peaks.map(function (p) {
      var i = document.createElement('i');
      i.style.height = Math.max(10, p) + '%';
      wave.appendChild(i);
      return i;
    });
    var dur = 20;
    function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function paint() {
      var d = audio.duration || dur;
      var r = Math.min(1, (audio.currentTime || 0) / d);
      var lit = Math.round(r * bars.length);
      for (var k = 0; k < bars.length; k++) bars[k].classList.toggle('on', k < lit);
      cur.textContent = fmt(audio.currentTime);
      wave.setAttribute('aria-valuenow', Math.round(audio.currentTime));
      wave.setAttribute('aria-valuetext', fmt(audio.currentTime) + ' de ' + fmt(d));
    }
    function seek(r) {
      var d = audio.duration || dur;
      try { audio.currentTime = Math.max(0, Math.min(d, r * d)); } catch (e) {}
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
      if (!fig._tracked && window.umami && typeof window.umami.track === 'function') { fig._tracked = true; try { window.umami.track('testimonio-audio', { pagina: location.pathname }); } catch (e) {} }
    });
    audio.addEventListener('pause', function () { fig.classList.remove('is-playing'); btn.setAttribute('aria-label', 'Escuchar el testimonio'); });
    audio.addEventListener('ended', function () { audio.currentTime = 0; paint(); });
    audio.addEventListener('timeupdate', paint);
    wave.addEventListener('pointerdown', function (e) {
      var rect = wave.getBoundingClientRect();
      if (audio.paused && audio.readyState < 1) audio.load();
      seek((e.clientX - rect.left) / rect.width);
    });
    wave.addEventListener('keydown', function (e) {
      var d = audio.duration || dur;
      if (e.key === 'ArrowRight') { seek((audio.currentTime + 2) / d); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { seek((audio.currentTime - 2) / d); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { btn.click(); e.preventDefault(); }
    });
  });
})();
