/** URL para navegar a una coordenada del cliente en Google Maps (cómo llegar). */
export function geoMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}