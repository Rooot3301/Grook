import { describe, it, expect, vi, beforeEach } from 'vitest';

// Le logger écrit dans logs/grook.log — on redirige avant l'import.
process.env.LOG_LEVEL = 'debug';

describe('logger', () => {
  let logger, getRecentLogs;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/utils/logger.js');
    logger = mod.logger;
    getRecentLogs = mod.getRecentLogs;
    // Silence stdout pendant les tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('empile les entrées dans le ring buffer, plus récent en tête', () => {
    logger.info('premier');
    logger.warn('deuxième');
    logger.error('troisième');

    const recent = getRecentLogs();
    expect(recent[0].msg).toBe('troisième');
    expect(recent[0].level).toBe('error');
    expect(recent[1].msg).toBe('deuxième');
    expect(recent[2].msg).toBe('premier');
  });

  it('filtre par niveau minimum', () => {
    logger.debug('spam');
    logger.info('info');
    logger.warn('warn');
    logger.error('err');
    const errsOnly = getRecentLogs(100, 'error');
    expect(errsOnly.every(e => e.level === 'error')).toBe(true);
  });

  it('sérialise les erreurs (message + stack)', () => {
    logger.error('boom', new Error('nope'));
    const [entry] = getRecentLogs();
    expect(entry.msg).toContain('boom');
    expect(entry.msg).toContain('nope');
  });

  it('gère les références circulaires sans planter', () => {
    const cyc = { name: 'grook' };
    cyc.self = cyc;
    expect(() => logger.info('boom', cyc)).not.toThrow();
  });
});
