/** URL para navegar a una coordenada del cliente en Google Maps (cómo llegar). */
export function geoMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

/**
 * Pide la ubicación del dispositivo (BYOD en campo). Reintenta con baja
 * precisión si el GPS de alta precisión falla o expira (interiores, permiso
 * lento), que es la causa típica del "no se pudo obtener la ubicación" en
 * Android. Resuelve `null` si no hay soporte o el usuario deniega/agota el
 * tiempo — el llamador decide si avisar (solo cuando aún no hay coordenadas).
 */
export function obtenerCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    const pedir = (altaPrecision: boolean) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {
          if (altaPrecision) pedir(false);
          else resolve(null);
        },
        // Alta precisión estricta primero; si falla, baja precisión con más
        // margen de tiempo (la posición de red suele bastar para la zona).
        {
          enableHighAccuracy: altaPrecision,
          timeout: altaPrecision ? 8000 : 15000,
          maximumAge: 60000,
        },
      );
    pedir(true);
  });
}
