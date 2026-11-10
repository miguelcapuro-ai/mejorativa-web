/* Configuración de CV en el Quirófano.
   api: URL del servicio privado (Cloudflare Worker).
   Vacío: en mejorativa.com la revisión dice "Muy pronto"; en otra dirección (o con ?demo) es una demostración con un CV ficticio. */
window.CVQ = {
  api: 'https://mejorativa-cv-api.miguelcapuro.workers.dev',
  precio: 9.99,
  whatsapp: '50763454868',
  // Yappy apagado hasta tener Yappy Comercial con Botón de Pago (nov. 2026). Para activarlo: true.
  yappy: false
};
