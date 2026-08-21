import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, LoadingRow } from '../components/Page.jsx';
import { useGuildData } from '../components/useGuildData.js';

export function Automod() {
  const { guildId } = useParams();
  const q = useGuildData((id) => api.automod(id));

  const [enabled,     setEnabled]     = useState(false);
  const [muteAt,      setMuteAt]      = useState('');
  const [muteDurMin,  setMuteDurMin]  = useState('');
  const [kickAt,      setKickAt]      = useState('');
  const [banAt,       setBanAt]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(null);

  useEffect(() => {
    if (!q.data) return;
    setEnabled(!!q.data.enabled);
    setMuteAt(q.data.warn_mute_at ?? '');
    setMuteDurMin(q.data.warn_mute_duration ? Math.floor(q.data.warn_mute_duration / 60) : '');
    setKickAt(q.data.warn_kick_at ?? '');
    setBanAt(q.data.warn_ban_at ?? '');
  }, [q.data]);

  if (q.loading) return <Page eyebrow="section 06" title="Automod"><LoadingRow /></Page>;

  const toNum   = (v) => v === '' || v === null ? null : Number(v);
  const dirty   = q.data && (
    !!q.data.enabled !== enabled ||
    (q.data.warn_mute_at       ?? null) !== toNum(muteAt) ||
    (q.data.warn_mute_duration ?? null) !== (toNum(muteDurMin) === null ? null : toNum(muteDurMin) * 60) ||
    (q.data.warn_kick_at       ?? null) !== toNum(kickAt) ||
    (q.data.warn_ban_at        ?? null) !== toNum(banAt)
  );

  async function save() {
    setSaving(true);
    try {
      await api.updateAutomod(guildId, {
        enabled: enabled ? 1 : 0,
        warn_mute_at:       toNum(muteAt),
        warn_mute_duration: toNum(muteDurMin) === null ? null : toNum(muteDurMin) * 60,
        warn_kick_at:       toNum(kickAt),
        warn_ban_at:        toNum(banAt),
      });
      setSaved(Date.now());
      q.reload();
      setTimeout(() => setSaved(null), 3000);
    } finally { setSaving(false); }
  }

  return (
    <Page
      eyebrow="section 06"
      title="Automod"
      description="Escalade automatique sur seuils de warn. Désactivée par défaut. Les seuils vides sont ignorés."
      actions={
        <>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (!confirm('Réinitialiser toute la config automod ?')) return;
              await api.resetAutomod(guildId);
              q.reload();
            }}
          >Réinitialiser</button>
          <button className="btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="panel p-5 mb-6 flex items-center justify-between gap-6">
        <div>
          <div className="text-sm font-medium mb-1">Escalade automatique</div>
          <p className="text-xs text-text-dim leading-relaxed max-w-xl">
            Quand activée, le bot applique automatiquement les sanctions ci-dessous quand un membre
            atteint le nombre de warns défini. Tous les seuils sont optionnels.
          </p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <ThresholdCard
          title="Mute automatique"
          emoji="🔇"
          description="Nombre de warns avant timeout automatique."
        >
          <NumInput label="Seuil (warns)"       value={muteAt}     onChange={setMuteAt}     min={1} max={100} placeholder="ex : 3" />
          <NumInput label="Durée (minutes)"     value={muteDurMin} onChange={setMuteDurMin} min={1} max={40320} placeholder="ex : 60" />
        </ThresholdCard>

        <ThresholdCard
          title="Kick automatique"
          emoji="👢"
          description="Nombre de warns avant expulsion du serveur."
        >
          <NumInput label="Seuil (warns)"       value={kickAt}     onChange={setKickAt}     min={1} max={100} placeholder="ex : 5" />
        </ThresholdCard>

        <ThresholdCard
          title="Ban automatique"
          emoji="🔨"
          description="Nombre de warns avant bannissement définitif."
        >
          <NumInput label="Seuil (warns)"       value={banAt}      onChange={setBanAt}      min={1} max={100} placeholder="ex : 7" />
        </ThresholdCard>
      </div>
    </Page>
  );
}

function ThresholdCard({ title, emoji, description, children }) {
  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-lg">{emoji}</div>
      </div>
      <p className="text-xs text-text-dim mb-4 leading-relaxed">{description}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NumInput({ label, value, onChange, min, max, placeholder }) {
  return (
    <label className="block">
      <div className="text-[11px] font-mono uppercase tracking-wider text-text-dim mb-1">{label}</div>
      <input
        type="number"
        inputMode="numeric"
        className="input"
        value={value ?? ''}
        min={min} max={max}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-3 px-3 py-2 rounded-md border transition-colors shrink-0
                  ${checked ? 'border-accent/60 bg-accent/10' : 'border-border bg-panel-2'}`}
    >
      <span className={`w-8 h-4 rounded-full relative transition-colors ${checked ? 'bg-accent' : 'bg-border'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-bg transition-transform
                          ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-sm">{checked ? 'Actif' : 'Désactivé'}</span>
    </button>
  );
}
