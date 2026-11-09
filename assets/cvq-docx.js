/* CV en el Quirófano · arma la hoja de vida propuesta en formato Harvard como archivo Word (.docx).
   Todo ocurre en el navegador: no sube nada a ningún servidor. Sin librerías externas. */
(function () {
  'use strict';

  /* ---------- ZIP sin compresión (suficiente para un .docx) ---------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), partes = [], central = [], off = 0;
    files.forEach(function (f) {
      var nombre = enc.encode(f.name), datos = enc.encode(f.data), crc = crc32(datos);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
      h.setUint32(18, datos.length, true); h.setUint32(22, datos.length, true); h.setUint16(26, nombre.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), nombre, datos);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, datos.length, true); c.setUint32(24, datos.length, true);
      c.setUint16(28, nombre.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nombre);
      off += 30 + nombre.length + datos.length;
    });
    var tam = central.reduce(function (s, x) { return s + x.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, tam, true); e.setUint32(16, off, true);
    return new Blob(partes.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------- Word ---------- */
  var FUENTE = 'Times New Roman', DER = 10800; // tabulación a la derecha (ancho útil en twips)
  function x(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Texto con los [corchetes] resaltados en amarillo para que la persona los vea y los complete.
  function runs(texto, o) {
    o = o || {};
    var rpr = '<w:rFonts w:ascii="' + FUENTE + '" w:hAnsi="' + FUENTE + '" w:cs="' + FUENTE + '"/>' + (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.caps ? '<w:caps/>' : '') + '<w:sz w:val="' + (o.sz || 22) + '"/>';
    return String(texto == null ? '' : texto).split(/(\[[^\[\]]{1,120}\])/).filter(Boolean).map(function (t) {
      var ph = /^\[.*\]$/.test(t);
      return '<w:r><w:rPr>' + rpr + (ph ? '<w:highlight w:val="yellow"/>' : '') + '</w:rPr><w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
    }).join('');
  }
  function p(contenido, o) {
    o = o || {};
    var ppr = '<w:spacing w:before="' + (o.antes || 0) + '" w:after="' + (o.despues != null ? o.despues : 0) + '"/>' +
      (o.centro ? '<w:jc w:val="center"/>' : '') +
      (o.tab ? '<w:tabs><w:tab w:val="right" w:pos="' + DER + '"/></w:tabs>' : '') +
      (o.borde ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' : '') +
      (o.vineta ? '<w:ind w:left="360" w:hanging="220"/>' : '') + (o.keep ? '<w:keepNext/>' : '');
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + contenido + '</w:p>';
  }
  var TAB = '<w:r><w:tab/></w:r>';
  function titulo(t) { return p(runs(t, { b: true, caps: true, sz: 22 }), { antes: 200, despues: 80, borde: true, keep: true }); }
  function vineta(t) { return p(runs('•  ') + runs(t), { vineta: true, despues: 20 }); }
  function filaDoble(izq, der, oIzq, oDer) { return p(runs(izq, oIzq) + (der ? TAB + runs(der, oDer) : ''), { tab: true, keep: true }); }

  function cuerpo(cv) {
    var h = [];
    h.push(p(runs(cv.nombre || '[Tu nombre completo]', { b: true, sz: 32 }), { centro: true, despues: 40 }));
    if (cv.titular) h.push(p(runs(cv.titular, { sz: 22 }), { centro: true, despues: 20 }));
    var linea = [cv.ubicacion, cv.contacto].filter(Boolean).join(' · ');
    if (linea) h.push(p(runs(linea, { sz: 20 }), { centro: true, despues: 120 }));
    if (cv.perfil) { h.push(titulo('Perfil profesional')); h.push(p(runs(cv.perfil), { despues: 40 })); }
    function experiencia() {
      if (!cv.experiencia || !cv.experiencia.length) return;
      h.push(titulo('Experiencia profesional'));
      cv.experiencia.forEach(function (e, i) {
        if (i) h.push(p('', { despues: 60 }));
        h.push(filaDoble(e.empresa, e.ubicacion, { b: true }, {}));
        h.push(filaDoble(e.cargo, e.periodo, { i: true }, {}));
        if (e.alcance) h.push(p(runs(e.alcance), { despues: 20 }));
        (e.logros || []).forEach(function (l) { h.push(vineta(l)); });
      });
    }
    function formacion() {
      if (!cv.formacion || !cv.formacion.length) return;
      h.push(titulo('Formación'));
      cv.formacion.forEach(function (f, i) {
        h.push(filaDoble(f.institucion, f.ubicacion, { b: true }, {}));
        h.push(filaDoble(f.titulo, f.periodo, { i: true }, {}));
        if (f.detalle) h.push(vineta(f.detalle));
        if (i < cv.formacion.length - 1) h.push(p('', { despues: 60 }));
      });
    }
    if (cv.orden === 'formacion_primero') { formacion(); experiencia(); } else { experiencia(); formacion(); }
    var hab = (cv.habilidades || []).filter(function (g) { return g && g.items; });
    if (hab.length || cv.idiomas) {
      h.push(titulo('Habilidades e idiomas'));
      hab.forEach(function (g) { h.push(p(runs(g.categoria + ': ', { b: true }) + runs(g.items), { despues: 20 })); });
      if (cv.idiomas) h.push(p(runs('Idiomas: ', { b: true }) + runs(cv.idiomas), { despues: 20 }));
    }
    (cv.extras || []).forEach(function (s) {
      if (!s || !s.items || !s.items.length) return;
      h.push(titulo(s.titulo));
      s.items.forEach(function (l) { h.push(vineta(l)); });
    });
    return h.join('');
  }

  function documento(cv) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + cuerpo(cv) +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="720" w:bottom="1080" w:left="720" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  function archivo(cv) {
    var estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + FUENTE + '" w:hAnsi="' + FUENTE + '" w:cs="' + FUENTE + '"/><w:sz w:val="22"/><w:lang w:val="es-PA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/document.xml', data: documento(cv) },
      { name: 'word/styles.xml', data: estilos },
    ]);
  }

  function descargar(cv) {
    var blob = archivo(cv);
    var base = String(cv.nombre || 'mi').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mi';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'CV-' + base + '-propuesta-Harvard.docx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  window.CVQ_DOCX = { archivo: archivo, descargar: descargar };
})();
