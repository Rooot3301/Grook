/**
 * Client WebSocket dédié pour /ws/logs — flux de logs système en direct.
 * Reconnexion exponentielle simple. Diffuse chaque log à un set de listeners.
 */
export function createLogStream({ minLevel = 'debug' } = {}) {
  const listeners = new Set();
  let socket = null;
  let attempt = 0;
  let closed = false;
  let currentLevel = minLevel;

  function connect() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${window.location.host}/ws/logs`);
    socket.onopen = () => {
      attempt = 0;
      try { socket.send(JSON.stringify({ minLevel: currentLevel })); } catch { /* ignore */ }
    };
    socket.onmessage = (msg) => {
      try {
        const entry = JSON.parse(msg.data);
        for (const l of listeners) l(entry);
      } catch { /* ignore */ }
    };
    socket.onclose = () => {
      if (closed) return;
      const delay = Math.min(30_000, 500 * Math.pow(2, attempt++));
      setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  }

  connect();

  return {
    on(fn)  { listeners.add(fn); return () => listeners.delete(fn); },
    setMinLevel(lvl) {
      currentLevel = lvl;
      if (socket?.readyState === 1) {
        try { socket.send(JSON.stringify({ minLevel: lvl })); } catch { /* ignore */ }
      }
    },
    close() { closed = true; socket?.close(); },
  };
}
