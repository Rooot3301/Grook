import { describe, it, expect, beforeAll } from 'vitest';

process.env.GROOK_DB_PATH = ':memory:';

let getAutomodConfig, setAutomodConfig, resetAutomodConfig;

beforeAll(async () => {
  ({ getAutomodConfig, setAutomodConfig, resetAutomodConfig } =
    await import('../src/database/repositories/AutomodRepository.js'));
});

describe('AutomodRepository', () => {
  const G = '333333333333333333';

  it('retourne les défauts (désactivé, aucun seuil) pour un serveur non configuré', () => {
    const cfg = getAutomodConfig(G);
    expect(cfg.enabled).toBe(0);
    expect(cfg.warn_mute_at).toBeNull();
    expect(cfg.warn_kick_at).toBeNull();
    expect(cfg.warn_ban_at).toBeNull();
  });

  it('setAutomodConfig persiste et upsert', () => {
    setAutomodConfig(G, { enabled: 1, warn_mute_at: 3, warn_mute_duration: 3600 });
    const cfg = getAutomodConfig(G);
    expect(cfg.enabled).toBe(1);
    expect(cfg.warn_mute_at).toBe(3);
    expect(cfg.warn_mute_duration).toBe(3600);
  });

  it('setAutomodConfig fait un patch partiel (sans écraser les autres champs)', () => {
    setAutomodConfig(G, { warn_kick_at: 5 });
    const cfg = getAutomodConfig(G);
    expect(cfg.warn_mute_at).toBe(3);   // conservé
    expect(cfg.warn_kick_at).toBe(5);
  });

  it('resetAutomodConfig remet tout aux défauts', () => {
    resetAutomodConfig(G);
    const cfg = getAutomodConfig(G);
    expect(cfg.enabled).toBe(0);
    expect(cfg.warn_mute_at).toBeNull();
    expect(cfg.warn_kick_at).toBeNull();
  });
});
