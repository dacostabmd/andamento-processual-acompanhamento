/**
 * Metadata do último snapshot lido do worker de sync — disponível em
 * PRODUÇÃO também, ao contrário de `debugSnapshot.ts` (que é só diagnóstico
 * de dev, para o painel flutuante). Alimenta o aviso "como os dados são
 * atualizados" mostrado a todo usuário no topo do dashboard
 * (AvisoSincronizacao.tsx) — por isso precisa existir fora do gate de DEV.
 */
export interface SnapshotInfo {
  /** ISO — quando este snapshot foi gravado pelo worker. */
  syncedAt: string
}

let info: SnapshotInfo | null = null
const ouvintes = new Set<() => void>()

function notificar(): void {
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function registrarSnapshotInfo(nova: SnapshotInfo): void {
  info = nova
  notificar()
}

export function lerSnapshotInfo(): SnapshotInfo | null {
  return info
}

export function assinarSnapshotInfo(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
