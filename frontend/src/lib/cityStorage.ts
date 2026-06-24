export const CITY_STORAGE_KEY = 'salonbook:city';

export function readStoredCity(): string {
  try {
    return localStorage.getItem(CITY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeStoredCity(city: string): void {
  try {
    localStorage.setItem(CITY_STORAGE_KEY, city.trim());
  } catch {
    // ignore quota / private mode
  }
}

export function homePathWithCity(city?: string | null): string {
  const trimmed = (city ?? readStoredCity()).trim();
  if (!trimmed) return '/';
  return `/?city=${encodeURIComponent(trimmed)}`;
}
