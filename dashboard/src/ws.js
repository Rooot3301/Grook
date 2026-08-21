/**
 * WebSocket client — /ws.
 * Reconnexion exponentielle simple. Diffuse chaque event à un set de listeners.
 */
export function createEventStream() {
  const listeners = new Set();
  let socket = null;
  let attempt = 0;
  let closed = false;

  function connect() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${window.location.host}/ws`);
    socket.onopen = () => { attempt = 0; };
    socket.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data);
        for (const l of listeners) l(evt);
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
    on(fn)  { listeners.add(fn);    return () => listeners.delete(fn); },
    close() { closed = true; socket?.close(); },
  };
}
