import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Hook générique pour charger de la donnée par guild.
 * @param {(id: string, signal: AbortSignal) => Promise<any>} loader
 * @returns { data, loading, error, reload }
 */
export function useGuildData(loader, deps = []) {
  const { guildId } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));
    loader(guildId, ctrl.signal)
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState({ data: null, loading: false, error: err });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, tick, ...deps]);

  return { ...state, reload: () => setTick(t => t + 1) };
}

export function formatDate(unix) {
  if (!unix) return '—';
  const ms = unix * 1000;
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelative(unix) {
  if (!unix) return '—';
  const diff = unix - Math.floor(Date.now() / 1000);
  const abs = Math.abs(diff);
  const past = diff < 0;

  const units = [
    ['an', 31536000], ['mois', 2592000], ['j', 86400],
    ['h', 3600], ['min', 60], ['s', 1],
  ];
  for (const [label, sec] of units) {
    if (abs >= sec || label === 's') {
      const v = Math.floor(abs / sec);
      return past ? `il y a ${v}${label === 'an' ? ' an' : label === 'mois' ? ' mois' : label}${label === 'an' && v > 1 ? 's' : ''}`
                  : `dans ${v}${label}`;
    }
  }
  return '—';
}
