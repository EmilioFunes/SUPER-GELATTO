// Estados de ventas realmente cobradas (cuentan como ingreso). Pendiente, Fallido y Cancelado no.
// Debe coincidir con ESTADOS_COBRADOS de backend/server.js (una prueba lo comprueba).
export const ESTADOS_COBRADOS = ['Pagado', 'En proceso', 'En entrega', 'Enviado', 'Entregado', 'Completado'];

export function soloVentasCobradas(ventas) {
  if (!Array.isArray(ventas)) return [];
  return ventas.filter((v) => ESTADOS_COBRADOS.includes(v && v.estado));
}
