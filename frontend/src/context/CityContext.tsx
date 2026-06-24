import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { detectCityFromLocation } from '../lib/location';
import { homePathWithCity, readStoredCity, writeStoredCity } from '../lib/cityStorage';

const DEFAULT_CITY = 'Mumbai';

export type CityContextValue = {
  city: string;
  setCity: (newCity: string, opts?: { replace?: boolean; navigateHome?: boolean }) => void;
  detecting: boolean;
  detectAndSetCity: () => Promise<string | undefined>;
};

export const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const urlCity = searchParams.get('city') ?? '';
  const [storedCity, setStoredCity] = useState(readStoredCity);
  const city = urlCity || storedCity;
  const [detecting, setDetecting] = useState(false);
  const detectStarted = useRef(false);

  const setCity = useCallback(
    (newCity: string, opts?: { replace?: boolean; navigateHome?: boolean }) => {
      const trimmed = newCity.trim();
      if (!trimmed) return;
      writeStoredCity(trimmed);
      setStoredCity(trimmed);

      if (opts?.navigateHome && pathname !== '/') {
        navigate(homePathWithCity(trimmed));
        return;
      }

      const params = new URLSearchParams(searchParams);
      params.set('city', trimmed);
      setSearchParams(params, { replace: opts?.replace ?? false });
    },
    [navigate, pathname, searchParams, setSearchParams],
  );

  const detectAndSetCity = useCallback(async () => {
    setDetecting(true);
    try {
      const detected = await detectCityFromLocation();
      const resolved = detected || readStoredCity() || DEFAULT_CITY;
      setCity(resolved, { replace: true });
      return resolved;
    } finally {
      setDetecting(false);
    }
  }, [setCity]);

  // Keep local state in sync when URL carries city (e.g. shared links)
  useEffect(() => {
    if (!urlCity) return;
    if (urlCity !== storedCity) {
      writeStoredCity(urlCity);
      setStoredCity(urlCity);
    }
  }, [urlCity, storedCity]);

  // Restore ?city= on home when user returns without query params
  useEffect(() => {
    if (pathname !== '/' || urlCity) return;
    const saved = readStoredCity();
    if (!saved) return;
    const params = new URLSearchParams(searchParams);
    params.set('city', saved);
    setSearchParams(params, { replace: true });
  }, [pathname, urlCity, searchParams, setSearchParams]);

  // Auto-detect only when no city in URL or storage
  useEffect(() => {
    if (pathname !== '/') return;
    if (urlCity || readStoredCity()) return;
    if (detectStarted.current) return;
    detectStarted.current = true;
    void detectAndSetCity();
  }, [pathname, urlCity, detectAndSetCity]);

  return (
    <CityContext.Provider value={{ city, setCity, detecting, detectAndSetCity }}>
      {children}
    </CityContext.Provider>
  );
}
