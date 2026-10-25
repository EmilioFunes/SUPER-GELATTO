// Configuración de pruebas. PGlite arranca un Postgres real en memoria (~1 s por base),
// por eso los tiempos de espera son más amplios que el valor por defecto.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
