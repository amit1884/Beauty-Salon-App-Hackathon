import { useContext } from 'react';
import { CityContext, type CityContextValue } from '../context/CityContext';

export function useSelectedCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useSelectedCity must be used within CityProvider');
  return ctx;
}
