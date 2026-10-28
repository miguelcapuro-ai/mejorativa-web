(function(){
  var d=document, root=d.documentElement;

  /* Copiar correo */
  d.querySelectorAll('.copy').forEach(function(b){
    b.addEventListener('click',function(){
      var done=function(){b.textContent='Copiado';setTimeout(function(){b.textContent='Copiar'},1800)};
      var fallback=function(){var r=d.createRange();r.selectNodeContents(d.getElementById('mail'));var s=getSelection();s.removeAllRanges();s.addRange(r)};
      try{navigator.clipboard.writeText(b.getAttribute('data-copy')).then(done,fallback)}catch(e){fallback()}
    });
  });

  /* Menú móvil */
  var burger=d.querySelector('.burger'), sheet=d.getElementById('menu');
  function setMenu(open){
    root.classList.toggle('menu-open',open);
    burger.setAttribute('aria-expanded',open?'true':'false');
    burger.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
    sheet.toggleAttribute('inert',!open);
  }
  if(burger&&sheet){
    sheet.setAttribute('inert','');
    burger.addEventListener('click',function(){setMenu(!root.classList.contains('menu-open'))});
    sheet.addEventListener('click',function(e){if(e.target.closest('a'))setMenu(false)});
    d.addEventListener('keydown',function(e){if(e.key==='Escape'&&root.classList.contains('menu-open')){setMenu(false);burger.focus()}});
  }

  /* CTA fijo móvil y volver arriba: aparecen después del primer pantallazo */
  var dock=d.querySelector('.dock'), top=d.querySelector('.totop');
  if(top)top.addEventListener('click',function(){scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});d.getElementById('contenido').focus({preventScroll:true})});
  var ticking=false;
  function onScroll(){ticking=false;var y=scrollY,h=innerHeight;
    if(dock)dock.classList.toggle('on',y>h*.6);
    if(top)top.classList.toggle('on',y>h*1.5);
  }
  addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});
  onScroll();

  /* Medición sin cookies (Umami): clics en WhatsApp, correo y teléfono */
  d.addEventListener('click',function(e){
    var a=e.target.closest('a[href]'); if(!a)return;
    var h=a.getAttribute('href'), ev=null;
    if(h.indexOf('wa.me')>-1)ev='clic_whatsapp'; else if(h.indexOf('mailto:')===0)ev='clic_correo'; else if(h.indexOf('tel:')===0)ev='clic_llamar';
    if(ev&&window.umami)umami.track(ev,{ubicacion:a.getAttribute('data-where')||'',pagina:location.pathname});
  });

  /* Aparición suave al hacer scroll */
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var targets=d.querySelectorAll('.sec .head, .pcard, .both, .vid, .pillar, .svc, .prog, .biz .pic, .steps li, .quote-band blockquote, .year, .vgrid, .about .wrap > *, .close .wrap > *, .ba-card, .outcomes > div, .journey li, .compare, .plan, .fit > div, .facil, .related > *, .faq, .terms');
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');e.target.classList.remove('pre');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
  targets.forEach(function(t){if(t.getBoundingClientRect().top>innerHeight){t.classList.add('pre');io.observe(t)}});
})();
