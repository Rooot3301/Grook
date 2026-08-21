import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDuration, formatDuration, safeSetTimeout } from '../src/utils/time.js';

describe('parseDuration', () => {
  it('parse formats standards', () => {
    expect(parseDuration('10s')).toBe(10_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('1d')).toBe(86_400_000);
    expect(parseDuration('1w')).toBe(604_800_000);
  });

  it('rejette les inputs invalides', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('10')).toBeNull();       // pas de suffixe
    expect(parseDuration('10x')).toBeNull();      // suffixe invalide
    expect(parseDuration('0s')).toBeNull();       // 0 refusé
    expect(parseDuration('-5m')).toBeNull();      // négatif refusé
  });

  it('accepte les majuscules et espaces', () => {
    expect(parseDuration('10S')).toBe(10_000);
    expect(parseDuration('  5m  ')).toBe(300_000);
  });
});

describe('formatDuration', () => {
  it('produit la plus grande unité qui matche', () => {
    expect(formatDuration(10_000)).toBe('10 secondes');
    expect(formatDuration(1_000)).toBe('1 seconde');
    expect(formatDuration(300_000)).toBe('5 minutes');
    expect(formatDuration(7_200_000)).toBe('2 heures');
    expect(formatDuration(86_400_000)).toBe('1 jour');
    expect(formatDuration(604_800_000)).toBe('1 semaine');
  });
});

describe('safeSetTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('déclenche le callback au bout du délai (délai court)', () => {
    const cb = vi.fn();
    safeSetTimeout(1_000, cb);
    vi.advanceTimersByTime(999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('supporte les délais > 24 jours (chaîne les timers)', () => {
    const cb = vi.fn();
    const DELAY = 30 * 24 * 60 * 60 * 1000; // 30 jours
    safeSetTimeout(DELAY, cb);
    // Un setTimeout natif au-delà de 2^31-1 déborderait et fire immédiatement.
    vi.advanceTimersByTime(DELAY - 1);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('cancel() empêche le déclenchement', () => {
    const cb = vi.fn();
    const handle = safeSetTimeout(1_000, cb);
    handle.cancel();
    vi.advanceTimersByTime(2_000);
    expect(cb).not.toHaveBeenCalled();
  });
});
