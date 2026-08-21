# Grook — dashboard

Front-end du dashboard d'administration.
React + Vite + Tailwind. Mono-user (le propriétaire déclaré via `BOT_OWNER_ID` côté bot), multi-guild.

## Dev

Le bot doit tourner en parallèle avec `DASHBOARD_ENABLED=true` (port 3000 par défaut).

```bash
cd dashboard
npm install
npm run dev            # http://localhost:5173, proxifie /api /auth /ws vers :3000
```

## Build (prod)

```bash
npm run build          # -> dashboard/dist/
```

Le bot sert automatiquement `dashboard/dist/` en statique dès qu'il détecte le dossier. En prod, on build une fois puis `./grook.sh restart`.

## Structure

- `src/App.jsx` — routes + session
- `src/api.js` — wrapper fetch
- `src/ws.js` — client WebSocket (`/ws`)
- `src/components/` — Layout, Page, hooks
- `src/pages/` — Login, Overview, Moderation, Games, Fun, Config, Journal

## Notes design

- Palette graphite chaud + accent ambre `#e5b83c` (registre foil), pas de dark AI-défaut
- Typo : Bricolage Grotesque (display) + Inter (UI) + JetBrains Mono (données)
- Signature : les case IDs traités comme des tampons (`.stamp` dans `styles.css`)
