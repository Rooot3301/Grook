import { describe, it, expect, beforeAll } from 'vitest';

process.env.GROOK_DB_PATH = ':memory:';

let createGiveaway, addParticipant, removeParticipant, getParticipantIds, endGiveaway, getActiveGiveaways;

beforeAll(async () => {
  ({
    createGiveaway, addParticipant, removeParticipant, getParticipantIds,
    endGiveaway, getActiveGiveaways,
  } = await import('../src/database/repositories/GiveawayRepository.js'));
});

describe('GiveawayRepository — participants persistés', () => {
  let g;

  beforeAll(() => {
    g = createGiveaway({
      guildId: 'g1', channelId: 'c1', prize: 'Lot test',
      hostId: 'host', endsAt: Date.now() + 60_000,
    });
  });

  it('ajoute et lit les participants', () => {
    addParticipant(g.id, 'u1');
    addParticipant(g.id, 'u2');
    addParticipant(g.id, 'u3');
    expect(getParticipantIds(g.id).sort()).toEqual(['u1', 'u2', 'u3']);
  });

  it('ignore les doublons (idempotent)', () => {
    addParticipant(g.id, 'u1');
    addParticipant(g.id, 'u1');
    const ids = getParticipantIds(g.id).filter(id => id === 'u1');
    expect(ids.length).toBe(1);
  });

  it('removeParticipant retire un participant', () => {
    removeParticipant(g.id, 'u2');
    expect(getParticipantIds(g.id).includes('u2')).toBe(false);
  });

  it('endGiveaway marque terminé et le retire de getActiveGiveaways', () => {
    endGiveaway(g.id, 'u1');
    expect(getActiveGiveaways().find(x => x.id === g.id)).toBeUndefined();
  });
});
