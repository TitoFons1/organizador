import { nowCivil } from '@organizador/shared';
import { useEffect, useState } from 'react';

/** Fecha y hora civiles de Madrid, renovadas cada minuto (p. ej. para el boton "Unirme"). */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => nowCivil());
  useEffect(() => {
    const timer = setInterval(() => setNow(nowCivil()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
