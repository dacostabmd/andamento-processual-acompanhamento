import { useSyncExternalStore } from 'react'
import { assinarSnapshotInfo, lerSnapshotInfo, type SnapshotInfo } from '../services/snapshotInfo'

/**
 * Metadata do último snapshot lido do worker (`syncedAt`), reativo a cada
 * novo snapshot buscado em qualquer parte do app — usado pelo fórum para
 * saber quando uma NOVA rodada de sync aconteceu e abrir um novo "dia" para
 * os comentários, sem precisar de fetch próprio.
 */
export function useSnapshotInfo(): SnapshotInfo | null {
  return useSyncExternalStore(assinarSnapshotInfo, lerSnapshotInfo)
}
