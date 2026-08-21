import { describe, it, expect, vi } from 'vitest';

// Ces gardes n'ont pas besoin de la DB (pure logique + interaction mock).
// On importe sanctions.js sans passer par la partie createCase/logCase.

// runSanctionGuards vit dans utils/sanctions.js — on importe uniquement ce nom.
// Le fichier importe DB/logCase mais on ne les touche pas ici (import statique OK).
process.env.GROOK_DB_PATH = ':memory:';

const { runSanctionGuards } = await import('../src/utils/sanctions.js');

function fakeInteraction({
  authorId = 'mod', targetId = 'target', botId = 'bot',
  memberRolePos = 10, targetRolePos = 5,
  moderatable = true, kickable = true, bannable = true,
  memberExists = true, targetIsBot = false,
} = {}) {
  const target = { id: targetId, bot: targetIsBot };
  const member = memberExists ? {
    moderatable, kickable, bannable,
    roles: { highest: { position: targetRolePos } },
  } : null;

  const replies = [];
  return {
    user:   { id: authorId },
    client: { user: { id: botId } },
    member: { roles: { highest: { position: memberRolePos } } },
    guild:  { members: { fetch: vi.fn(async () => member) } },
    reply:  vi.fn(async (opts) => { replies.push(opts); }),
    _target: target,
    _replies: replies,
  };
}

describe('runSanctionGuards', () => {
  it('refuse une action sur soi-même', async () => {
    const ctx = fakeInteraction({ authorId: 'same', targetId: 'same' });
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(false);
    expect(ctx._replies[0].content).toMatch(/toi-même/i);
  });

  it('refuse une action sur le bot', async () => {
    const ctx = fakeInteraction({ targetId: 'bot', botId: 'bot' });
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(false);
    expect(ctx._replies[0].content).toMatch(/moi/i);
  });

  it('refuse une action sur un autre bot', async () => {
    const ctx = fakeInteraction({ targetIsBot: true });
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(false);
    expect(ctx._replies[0].content).toMatch(/bot/i);
  });

  it('refuse si le membre n\'est pas dans le serveur', async () => {
    const ctx = fakeInteraction({ memberExists: false });
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(false);
    expect(ctx._replies[0].content).toMatch(/introuvable/i);
  });

  it('refuse si le bot n\'a pas la capacité', async () => {
    const ctx = fakeInteraction({ bannable: false });
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(false);
    expect(ctx._replies[0].content).toMatch(/rôle/i);
  });

  it('refuse si la cible a un rôle >= au modo', async () => {
    const ctx = fakeInteraction({ memberRolePos: 5, targetRolePos: 5 });
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(false);
    expect(ctx._replies[0].content).toMatch(/rôle/i);
  });

  it('accepte quand tous les checks passent', async () => {
    const ctx = fakeInteraction();
    const res = await runSanctionGuards(ctx, ctx._target, 'bannable');
    expect(res.ok).toBe(true);
    expect(res.member).toBeTruthy();
    expect(ctx._replies.length).toBe(0);
  });
});
