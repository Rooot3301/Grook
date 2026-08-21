import { describe, it, expect, beforeAll } from 'vitest';

// Force la DB en mémoire AVANT l'import de src/database/index.js
process.env.GROOK_DB_PATH = ':memory:';

let createCase, getAllCases, removeCase, getCase;

beforeAll(async () => {
  ({ createCase, getAllCases, removeCase, getCase } = await import('../src/database/repositories/CaseRepository.js'));
});

describe('CaseRepository', () => {
  const GUILD_A = '111111111111111111';
  const GUILD_B = '222222222222222222';

  it('génère des case IDs séquentiels par guild', () => {
    const c1 = createCase({ guildId: GUILD_A, userId: 'u1', type: 'WARN', reason: 'test 1', moderatorId: 'mod' });
    const c2 = createCase({ guildId: GUILD_A, userId: 'u2', type: 'BAN',  reason: 'test 2', moderatorId: 'mod' });
    const c3 = createCase({ guildId: GUILD_A, userId: 'u3', type: 'KICK', reason: 'test 3', moderatorId: 'mod' });

    expect(c1.case_id).toMatch(/^GRC-\d{8}-00001$/);
    expect(c2.case_id).toMatch(/^GRC-\d{8}-00002$/);
    expect(c3.case_id).toMatch(/^GRC-\d{8}-00003$/);
    expect(c1.guild_seq).toBe(1);
    expect(c3.guild_seq).toBe(3);
  });

  it('les guilds sont indépendantes (chaque guild démarre à 1)', () => {
    const b1 = createCase({ guildId: GUILD_B, userId: 'x1', type: 'WARN', reason: 'b', moderatorId: 'mod' });
    expect(b1.case_id).toMatch(/^GRC-\d{8}-00001$/);
    expect(b1.guild_seq).toBe(1);
  });

  it('createCase reste séquentiel sous appels rapides successifs (transaction)', () => {
    const ids = [];
    for (let i = 0; i < 50; i++) {
      const c = createCase({ guildId: 'stress', userId: 'u', type: 'WARN', reason: `x${i}`, moderatorId: 'm' });
      ids.push(c.guild_seq);
    }
    // Attendu : 1..50 exactement, sans doublons ni trous
    expect(ids).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('removeCase retire le cas et le renvoie, null si inconnu', () => {
    const c = createCase({ guildId: 'rm', userId: 'u', type: 'MUTE', reason: 'r', moderatorId: 'm' });
    expect(getCase('rm', c.case_id)).toBeDefined();
    const removed = removeCase('rm', c.case_id);
    expect(removed.case_id).toBe(c.case_id);
    expect(getCase('rm', c.case_id)).toBeUndefined();
    expect(removeCase('rm', 'GRC-00000000-99999')).toBeNull();
  });

  it('getAllCases retourne les cas récents en premier', () => {
    createCase({ guildId: 'order', userId: 'a', type: 'WARN', reason: 'r1', moderatorId: 'm' });
    createCase({ guildId: 'order', userId: 'b', type: 'WARN', reason: 'r2', moderatorId: 'm' });
    const list = getAllCases('order');
    expect(list[0].reason).toBe('r2');
    expect(list[1].reason).toBe('r1');
  });
});
