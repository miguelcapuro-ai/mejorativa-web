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


  /* ===== Sorpresas · nov 2026 ===== */
  var TIENDA='https://tienda.mejorativa.com';
  /* Regla de las frases: cada una se tiene que entender sola, sin depender de la parte del refrán que se omite.
     «Llévala puesta» solo sale con las frases que están en la tienda (enTienda); revisar la lista al sumar o quitar productos. */
  var enTienda=['El fin justifica… los miedos.','Dalo hoy… aunque sea temblando.','Cuando una puerta se cierra… yo construyo otra.','Ver para creer… creer para ver.','En mi mente… ya soy el mejor.','Nunca es tarde… llegaste con más historia y experiencia.','El que la hace, la paga… y el que no suelta, cumple condena.','Dime con quién andas… y te diré dónde floreces.','A veces tengo miedo… porque todo lo que pasa por mi mente se vuelve realidad.','El que busca… se encuentra.'];
  var cuentos=['El fin justifica… los miedos.','Dalo hoy… aunque sea temblando.','Cuando una puerta se cierra… yo construyo otra.','Ver para creer… creer para ver.','En mi mente… ya soy el mejor.','Nunca es tarde… llegaste con más historia y experiencia.','Más vale malo conocido… hasta que perdiste tiempo valioso allí.','El que la hace, la paga… y el que no suelta, cumple condena.','Dime con quién andas… y te diré dónde floreces.','Cada quien tiene lo que se merece… o lo que puede sostener.','A Dios rogando… y con los pies andando.','A veces tengo miedo… porque todo lo que pasa por mi mente se vuelve realidad.','El que se fue a Sevilla perdió su silla… yo traje la mía.','En boca cerrada… no entran descuentos.','El que busca… se encuentra.','Temblando… pero voy.','Crea fama… y échate a crecer.'];
  var propias=['No somos lo que decimos. Somos lo que repetimos.','Cambia el observador y cambia el resultado.','Toda conversación es una oportunidad de crear un futuro distinto.','Damos lo que somos. Ni más, ni menos.','Atrévete a ser más.'];
  function pick(a){return a[Math.floor(Math.random()*a.length)]}

  /* Frase escondida en el check del logo */
  d.querySelectorAll('.brand').forEach(function(b){
    var t=d.createElement('span');t.className='brand-secret';t.setAttribute('aria-hidden','true');
    t.innerHTML='';t.appendChild(d.createTextNode(pick(propias.concat(cuentos))));
    var i=d.createElement('i');i.textContent='Encontraste el check';t.appendChild(i);
    b.appendChild(t);
  });

  /* Frase para hoy, distinta en cada visita */
  var foot=d.querySelector('footer .wrap');
  if(foot){
    var useC=Math.random()<.6, fr=useC?pick(cuentos):pick(propias);
    var box=d.createElement('p');box.className='daily';
    var lb=d.createElement('b');lb.textContent='Frase para hoy';
    var q=d.createElement('q');q.textContent=fr;
    box.appendChild(lb);box.appendChild(q);
    if(useC&&enTienda.indexOf(fr)>-1){var a=d.createElement('a');a.href=TIENDA;a.target='_blank';a.rel='noopener';a.textContent='Llévala puesta';box.appendChild(a)}
    foot.insertBefore(box,foot.firstChild);
  }

  /* Cinta: cada frase se voltea y muestra una pregunta */
  var band=d.querySelector('.phrases');
  if(band){
    var holdT;
    band.querySelectorAll('.track li[data-q]').forEach(function(li){
      var hidden=li.closest('ul[aria-hidden]');
      var svg=li.querySelector('svg'); if(svg)li.removeChild(svg);
      var txt=li.textContent;li.textContent='';
      var btn=d.createElement('button');btn.type='button';btn.className='pf';
      if(hidden)btn.tabIndex=-1;
      btn.setAttribute('aria-pressed','false');
      var f=d.createElement('span');f.className='pf-f';f.textContent=txt;
      var bk=d.createElement('span');bk.className='pf-b';bk.textContent=li.getAttribute('data-q');
      btn.appendChild(f);btn.appendChild(bk);li.appendChild(btn);if(svg)li.appendChild(svg);
      btn.addEventListener('click',function(){
        var on=!btn.classList.contains('on');
        btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',on?'true':'false');
        band.classList.add('hold');clearTimeout(holdT);
        holdT=setTimeout(function(){band.classList.remove('hold');band.querySelectorAll('.pf.on').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-pressed','false')})},6500);
      });
    });
  }

  /* Historia del tornillo */
  var sb=d.querySelector('.screw-btn'), st=d.getElementById('screw-story');
  if(sb&&st)sb.addEventListener('click',function(){var o=st.hasAttribute('hidden');st.toggleAttribute('hidden',!o);sb.setAttribute('aria-expanded',o?'true':'false');sb.firstChild.nodeValue=o?'Cerrar la historia ':'Ver la historia '});
  var screw=d.querySelector('.screw');
  if(screw){if('IntersectionObserver' in window){var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){screw.classList.add('seen');so.disconnect()}})},{threshold:.25});so.observe(screw)}else screw.classList.add('seen')}

  /* Trayectoria: ver años anteriores */
  var my=d.querySelector('.more-years'), old=d.getElementById('tray-older');
  if(my&&old)my.addEventListener('click',function(){var o=old.hasAttribute('hidden');old.toggleAttribute('hidden',!o);my.setAttribute('aria-expanded',o?'true':'false');my.firstChild.nodeValue=o?'Ocultar 2022 a 2024 ':'Ver 2022 a 2024 '});

  /* Aparición suave al hacer scroll */
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var targets=d.querySelectorAll('.sec .head, .pcard, .both, .vid, .pillar, .svc, .prog, .biz .pic, .steps li, .quote-band blockquote, .year, .vgrid, .about .wrap > *, .close .wrap > *, .ba-card, .outcomes > div, .journey li, .compare, .plan, .fit > div, .facil, .related > *, .faq, .terms');
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');e.target.classList.remove('pre');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
  targets.forEach(function(t){if(t.getBoundingClientRect().top>innerHeight){t.classList.add('pre');io.observe(t)}});
})();

/* Navegación: sección actual en móvil y presentación del menú en la primera visita */
(function(){
  var d=document, nav=d.querySelector('.nav'), brand=d.querySelector('.island .brand');
  if(!nav||!brand) return;
  var cur=nav.querySelector('a[aria-current]:not(.btn)');
  if(cur){var h=d.createElement('span');h.className='here';h.textContent=cur.textContent.trim();h.setAttribute('aria-hidden','true');brand.insertAdjacentElement('afterend',h);brand.parentNode.classList.add('con-here')}
  nav.querySelectorAll('a[data-nav]').forEach(function(a,i){a.style.setProperty('--k',i)});
  var KEY='mj-nav-visto', visto=false;
  try{visto=localStorage.getItem(KEY)==='1'}catch(e){}
  if(visto) return;
  var root=d.documentElement; root.classList.add('nav-intro');
  var movil=matchMedia('(max-width:1060px)').matches;
  var hint=d.createElement('div'); hint.className='nav-hint'; hint.setAttribute('role','status');
  hint.textContent=movil?'Toca aquí para ver todas las secciones':'Desde aquí eliges a dónde ir';
  d.body.appendChild(hint);
  function colocar(){var t=movil?d.querySelector('.burger'):nav;if(!t)return;var r=t.getBoundingClientRect(),hw=hint.offsetWidth,cx=r.left+r.width/2,left=Math.min(Math.max(cx,hw/2+12),innerWidth-hw/2-12);hint.style.left=left+'px';hint.style.top=(r.bottom+14)+'px';hint.style.setProperty('--ax',(cx-left+hw/2)+'px')}
  function cerrar(){hint.classList.remove('on');setTimeout(function(){hint.remove()},600);root.classList.remove('nav-intro');try{localStorage.setItem(KEY,'1')}catch(e){};removeEventListener('scroll',alScroll)}
  function alScroll(){if(scrollY>220)cerrar()}
  setTimeout(function(){colocar();hint.classList.add('on')},900);
  setTimeout(cerrar,7500);
  addEventListener('scroll',alScroll,{passive:true});
  nav.addEventListener('click',cerrar,{once:true});
  addEventListener('resize',colocar);
})();
