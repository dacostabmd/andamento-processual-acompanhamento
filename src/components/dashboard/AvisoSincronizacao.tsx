import { Text } from '@mantine/core'
import { useSyncExternalStore } from 'react'
import { assinarSnapshotInfo, lerSnapshotInfo } from '../../services/snapshotInfo'
import { JANELA_PADRAO_DIAS } from '../../types/domain'
import classes from './AvisoSincronizacao.module.css'

/** Mesmo estilo de "X min/h/dia(s) atrás" já usado no painel de debug (DebugBitrixPanel). */
function formatarRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutos = Math.round(diffMs / 60_000)
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `${minutos} min atrás`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `${horas} h atrás`
  return `${Math.round(horas / 24)} dia(s) atrás`
}

/**
 * Aviso fixo no topo do dashboard explicando, em linguagem simples, de onde
 * vêm os dados — pedido do usuário para deixar explícito que o painel NÃO é
 * uma conexão em tempo real com o Bitrix24.
 *
 * Fatos por trás do texto (worker-nodejs-andamento/src/sync.ts e config.ts):
 * a sincronização roda automaticamente 1x por dia, de madrugada (mira meia-
 * noite, tenta de novo até as 8h se precisar, horário de Brasília), e cada
 * rodada só busca tarefas dos últimos JANELA_PADRAO_DIAS dias (por data de
 * criação). Não existe botão de "sincronizar agora" nesta tela.
 */
export function AvisoSincronizacao() {
  const info = useSyncExternalStore(assinarSnapshotInfo, lerSnapshotInfo, lerSnapshotInfo)

  return (
    <div className={classes.aviso} role="note">
      <svg
        className={classes.icone}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <div>
        <Text size="sm" fw={600}>
          Como os dados deste painel são atualizados
        </Text>
        <Text size="xs" c="dimmed">
          Uma vez por dia, de madrugada, o sistema busca automaticamente no Bitrix24 as tarefas dos
          últimos {JANELA_PADRAO_DIAS} dias e atualiza os números aqui — não é uma conexão em tempo
          real. Uma tarefa criada ou concluída agora só aparece neste painel a partir da atualização
          da próxima madrugada, e tarefas mais antigas que {JANELA_PADRAO_DIAS} dias não entram
          neste recorte.
          {info && <> Última atualização: {formatarRelativo(info.syncedAt)}.</>}
        </Text>
      </div>
    </div>
  )
}
