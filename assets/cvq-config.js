/* Configuración de CV en el Quirófano.
   api: URL del servicio privado (Cloudflare Worker).
   Vacío: en mejorativa.com la revisión dice "Muy pronto"; en otra dirección (o con ?demo) es una demostración con un CV ficticio. */
window.CVQ = {
  api: 'https://panel.mejorativa.com',
  precio: 9.99,
  whatsapp: '50763454868',
  // Yappy Comercial con Botón de Pago activo desde el 11 nov 2026 (solo se muestra a quien entra desde Panamá).
  yappy: true,
  // Precio aproximado en moneda local, según el país desde donde entra la persona. El cobro siempre es en dólares.
  // Tasas revisadas el 15 nov 2026 (últimas publicadas): MXN 18,57 (promedio del 10 nov, eldolar.info);
  // COP 3.297 (TRM del 12 nov, Superintendencia Financiera); CRC 455 (BCCR ~450 el 4 nov y ~458 después);
  // EUR 0,897 (8 nov). Revisarlas cada mes: el texto dice «unos», así que no hace falta exactitud diaria.
  monedaLocal: {
    monedas: {
      MXN: { tasa: 18.57, redondeo: 5, nombre: 'pesos mexicanos' },
      COP: { tasa: 3297, redondeo: 500, nombre: 'pesos colombianos' },
      CRC: { tasa: 455, redondeo: 50, nombre: 'colones' },
      EUR: { tasa: 0.897, redondeo: 1, nombre: 'euros' }
    },
    paises: { MX: 'MXN', CO: 'COP', CR: 'CRC', ES: 'EUR', PT: 'EUR', FR: 'EUR', IT: 'EUR', DE: 'EUR', NL: 'EUR', BE: 'EUR', IE: 'EUR', AT: 'EUR' }
  }
};
