import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * public/snapshot-mock.json é dado real (599 tarefas + nomes de funcionários)
 * usado só em dev sem VITE_SYNC_API_URL (ver dashboardService.ts). O Vite
 * copia TUDO de public/ para dist/ por padrão — sem este plugin o mock
 * vazaria pro build de produção como arquivo estático público. Já vazou uma
 * vez como chunk JS (import() dinâmico sempre gera chunk, mesmo atrás de
 * `if (DEV)`); isto garante que não sobrevive de nenhuma forma.
 */
function removerSnapshotMockDoDist(): Plugin {
  return {
    name: 'remover-snapshot-mock-do-dist',
    apply: 'build',
    closeBundle() {
      const caminho = resolve(__dirname, 'dist/snapshot-mock.json')
      if (existsSync(caminho)) rmSync(caminho)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), removerSnapshotMockDoDist()],
})
