import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    // Force chaque test de repository à créer son propre DB en mémoire.
    // Les tests qui touchent au module db doivent set `GROOK_DB_PATH=:memory:`
    // avant leur premier import.
    isolate: true,
  },
});
