/**
 * Wrapper fetch minimal — envoie les cookies, throw sur erreur.
 * Toutes les routes /api/ sont derrière le cookie de session (BOT_OWNER_ID).
 */
async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401) {
    // Session expirée ou absente.
    //  - Si on est sur '/', App.jsx catche le throw et affiche <Login/> ;
    //    un redirect vers '/' recauserait une boucle infinie.
    //  - Si on est sur une page authed (ex: /g/123/moderation), on renvoie
    //    l'utilisateur vers '/' pour qu'il voie l'écran de login.
    const onLoginPage = window.location.pathname === '/';
    if (!onLoginPage && !path.startsWith('/api/me')) {
      window.location.href = '/';
    }
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    const err = new Error(data?.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me:            ()                        => request('/api/me'),
  guilds:        ()                        => request('/api/guilds'),
  guild:         (id)                      => request(`/api/guilds/${id}`),
  config:        (id)                      => request(`/api/guilds/${id}/config`),
  updateConfig:  (id, body)                => request(`/api/guilds/${id}/config`, { method: 'PATCH', body }),
  resetConfig:   (id)                      => request(`/api/guilds/${id}/config/reset`, { method: 'POST' }),
  cases:         (id)                      => request(`/api/guilds/${id}/cases`),
  removeCase:    (id, caseId)              => request(`/api/guilds/${id}/cases/${caseId}`, { method: 'DELETE' }),
  warnings:      (id)                      => request(`/api/guilds/${id}/warnings`),
  removeWarn:    (id, warnId)              => request(`/api/guilds/${id}/warnings/${warnId}`, { method: 'DELETE' }),
  tempbans:      (id)                      => request(`/api/guilds/${id}/tempbans`),
  unbanUser:     (id, userId, reason)      => request(`/api/guilds/${id}/tempbans/${userId}/unban`, { method: 'POST', body: { reason } }),
  giveaways:     (id)                      => request(`/api/guilds/${id}/giveaways`),
  endGiveaway:   (id, giveawayId)          => request(`/api/guilds/${id}/giveaways/${giveawayId}/end`, { method: 'POST' }),
  stats:         (id)                      => request(`/api/guilds/${id}/stats`),
  automod:       (id)                      => request(`/api/guilds/${id}/automod`),
  updateAutomod: (id, body)                => request(`/api/guilds/${id}/automod`, { method: 'PATCH', body }),
  resetAutomod:  (id)                      => request(`/api/guilds/${id}/automod/reset`, { method: 'POST' }),
  systemInfo:    ()                        => request('/api/system/info'),
  systemLogs:    (limit = 100, level = 'debug') => request(`/api/system/logs?limit=${limit}&level=${level}`),
  userSearch:    (id, q)                   => request(`/api/guilds/${id}/users/search?q=${encodeURIComponent(q)}`),
  userDetail:    (id, userId)              => request(`/api/guilds/${id}/users/${userId}`),
};
