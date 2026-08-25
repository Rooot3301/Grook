import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, LoadingRow } from '../components/Page.jsx';
import { useGuildData } from '../components/useGuildData.js';

export function Config() {
  const { guildId } = useParams();
  const cfgQ    = useGuildData((id) => api.config(id));
  const guildQ  = useGuildData((id) => api.guild(id));

  const [modlogs, setModlogs] = useState('');
  const [welcome, setWelcome] = useState('');
  const [scanner, setScanner] = useState(false);
  const [antiscam, setAntiscam] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(null);

  useEffect(() => {
    if (!cfgQ.data) return;
    setModlogs(cfgQ.data.modlogs_channel_id ?? '');
    setWelcome(cfgQ.data.welcome_channel_id ?? '');
    setScanner(!!cfgQ.data.vt_scanner);
    setAntiscam(!!cfgQ.data.anti_scam);
  }, [cfgQ.data]);

  const dirty = cfgQ.data && (
    (cfgQ.data.modlogs_channel_id ?? '') !== modlogs ||
    (cfgQ.data.welcome_channel_id ?? '') !== welcome ||
    !!cfgQ.data.vt_scanner !== scanner ||
    !!cfgQ.data.anti_scam  !== antiscam
  );

  if (cfgQ.loading || guildQ.loading) {
    return <Page eyebrow="section 05" title="Configuration"><LoadingRow /></Page>;
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateConfig(guildId, {
        modlogs_channel_id: modlogs || null,
        welcome_channel_id: welcome || null,
        vt_scanner:         scanner ? 1 : 0,
        anti_scam:          antiscam ? 1 : 0,
      });
      setSaved(Date.now());
      cfgQ.reload();
      setTimeout(() => setSaved(null), 3000);
    } finally { setSaving(false); }
  }

  const channels = guildQ.data?.channels || [];

  return (
    <Page
      eyebrow="section 05"
      title="Configuration"
      description="Réglages persistés par serveur — modification immédiate côté bot."
      actions={
        <>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (!confirm('Remettre la configuration aux valeurs par défaut ?')) return;
              await api.resetConfig(guildId);
              cfgQ.reload();
            }}
          >Réinitialiser</button>
          <button className="btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Field
          label="Salon des logs de modération"
          hint="Toutes les sanctions (ban, kick, mute, warn…) sont envoyées ici."
        >
          <ChannelSelect value={modlogs} channels={channels} onChange={setModlogs} />
        </Field>

        <Field
          label="Salon de bienvenue"
          hint="Embed de bienvenue envoyé aux nouveaux membres."
        >
          <ChannelSelect value={welcome} channels={channels} onChange={setWelcome} />
        </Field>

        <Field
          label="Scanner VirusTotal"
          hint="Analyse automatique des liens postés. Nécessite VIRUSTOTAL_API_KEY côté serveur."
        >
          <Toggle checked={scanner} onChange={setScanner} label={scanner ? 'Activé' : 'Désactivé'} />
        </Field>

        <Field
          label="Anti-scam"
          hint="Détecte + supprime les token grabbers connus (MrBeast, Nitro gift, Steam gift, etc.). Timeout 2h sur les comptes source si signal fort."
        >
          <Toggle checked={antiscam} onChange={setAntiscam} label={antiscam ? 'Activé' : 'Désactivé'} />
        </Field>
      </div>

      <div className="mt-8 h-eyebrow">Identifiants</div>
      <div className="mt-2 panel p-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="h-eyebrow mb-1">Guild ID</div>
          <div className="font-mono text-xs">{guildId}</div>
        </div>
        <div>
          <div className="h-eyebrow mb-1">Membres</div>
          <div className="font-mono tabular-nums">{guildQ.data?.memberCount?.toLocaleString('fr-FR')}</div>
        </div>
      </div>
    </Page>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block panel p-5">
      <div className="text-sm font-medium mb-1">{label}</div>
      {hint && <p className="text-xs text-text-dim mb-3 leading-relaxed">{hint}</p>}
      {children}
    </label>
  );
}

function ChannelSelect({ value, channels, onChange }) {
  return (
    <select className="select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— Aucun —</option>
      {channels.map(c => (
        <option key={c.id} value={c.id}>#{c.name}</option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-3 px-3 py-2 rounded-md border transition-colors
                  ${checked ? 'border-accent/60 bg-accent/10' : 'border-border bg-panel-2'}`}
    >
      <span className={`w-8 h-4 rounded-full relative transition-colors
                        ${checked ? 'bg-accent' : 'bg-border'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-bg transition-transform
                          ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
