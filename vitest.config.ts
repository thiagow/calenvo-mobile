import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Mesmo fuso da produção (Netlify Functions rodam em UTC), herdado pelos
// workers. Rodar a suíte no fuso da máquina do dev (GMT-3) escondia justamente
// os bugs de fuso: código que montava horário de parede com métodos locais do
// processo passava local e quebrava só no ar.
process.env.TZ = 'UTC'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    setupFiles: ['dotenv/config'],
  },
})
