const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

function extractCity(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  return (
    address.city
    || address.town
    || address.village
    || address.municipality
    || address.state_district
    || address.county
    || null
  );
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  });
}

export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('zoom', '10');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { address?: Record<string, string> };
  return extractCity(data.address);
}

export async function detectCityFromLocation(): Promise<string | null> {
  try {
    const pos = await getCurrentPosition();
    return reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return null;
  }
}
