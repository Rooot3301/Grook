import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

/**
 * Palette de recherche globale — Ctrl+K / Cmd+K pour ouvrir.
 * Cherche sur : utilisateurs (via /users/search), cases (case IDs qui matchent),
 * et propose des raccourcis de navigation vers les pages.
 */
export function GlobalSearch() {
  const { guildId } = useParams();
  const [open, setOpen]       = useState(false);
  const [q, setQ]             = useState('');
  const [users, setUsers]     = useState([]);
  const [cases, setCases]     = useState([]);
  const [cursor, setCursor]   = useState(0);
  const navigate              = useNavigate();
  const inputRef              = useRef(null);
  const debounceRef           = useRef(null);

  // Raccourci clavier global Ctrl/Cmd+K
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Recherche debounced
  useEffect(() => {
    if (!open || q.length < 2) { setUsers([]); setCases([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const [uRes, allCases] = await Promise.all([
          api.userSearch(guildId, q),
          api.cases(guildId).then(r => r.items ?? r),
        ]);
        setUsers((uRes.items ?? []).slice(0, 6));
        const qU = q.toUpperCase();
        setCases((allCases ?? []).filter(c => c.case_id.includes(qU) || c.type.includes(qU)).slice(0, 6));
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [q, open, guildId]);

  const results = [
    ...users.map(u => ({ kind: 'user',  ...u })),
    ...cases.map(c => ({ kind: 'case',  ...c })),
  ];

  useEffect(() => setCursor(0), [q]);

  function pick(idx) {
    const r = results[idx];
    if (!r) return;
    if (r.kind === 'user') navigate(`/g/${guildId}/users`);
    if (r.kind === 'case') navigate(`/g/${guildId}/moderation`);
    setOpen(false);
    setQ('');
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    if (e.key === 'Enter')     { pick(cursor); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-text-dim hover:text-text hover:border-accent/50 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-xs">Rechercher…</span>
        <kbd className="ml-2 text-[10px] font-mono border border-border rounded px-1 py-0.5">Ctrl K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start pt-24 bg-bg/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="panel w-[560px] max-w-[92vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-text-dim">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Utilisateur, tag, ID ou case ID…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-dim"
          />
          <kbd className="text-[10px] font-mono text-text-dim">ESC</kbd>
        </div>

        {results.length === 0 && (
          <div className="py-8 text-center text-xs text-text-dim">
            {q.length < 2 ? 'Tape au moins 2 caractères.' : 'Aucun résultat.'}
          </div>
        )}

        <div className="max-h-[400px] overflow-auto">
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.id ?? r.case_id}`}
              onClick={() => pick(i)}
              onMouseEnter={() => setCursor(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left
                          ${cursor === i ? 'bg-panel-2' : ''}`}
            >
              {r.kind === 'user' && (
                <>
                  <img src={r.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{r.displayName}</div>
                    <div className="text-[10px] font-mono text-text-dim truncate">{r.tag} · {r.id}</div>
                  </div>
                  <span className="tag-neutral">user</span>
                </>
              )}
              {r.kind === 'case' && (
                <>
                  <span className="stamp">{r.case_id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-text-dim">{r.type} · <span className="font-mono">{r.user_id.slice(-6)}</span></div>
                    <div className="text-[10px] text-text-dim truncate">{r.reason}</div>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
