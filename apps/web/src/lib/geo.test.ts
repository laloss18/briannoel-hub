import { describe, expect, it } from 'vitest';
import { geoMapsUrl } from './geo';

describe('geoMapsUrl', () => {
  it('construye la URL de Google Maps con lat,lng codificados', () => {
    expect(geoMapsUrl(10.5, -66.9)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('10.5,-66.9')}`,
    );
  });

  it('codifica la coma como %2C', () => {
    expect(geoMapsUrl(10.5, -66.9)).toContain('query=10.5%2C-66.9');
  });
});
