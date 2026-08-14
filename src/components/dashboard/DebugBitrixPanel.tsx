import { ActionIcon, Badge, Group, Text } from '@mantine/core'
import { useState, useSyncExternalStore } from 'react'
import {
  assinarDebug,
  debugBitrixAtivo,
  lerSnapshotDebug,
  type ChamadaCapturada,
} from '../../services/debugBitrix'
import { assinarSnapshotDebug, lerSnapshotMetadataDebug } from '../../services/debugSnapshot'
import { apiUrlMascarada } from '../../services/bitrixRest'
import { fonteAtiva, type FonteBitrix } from '../../services/bitrixTransport'
import classes from './DebugBitrixPanel.module.css'

const ROTULO_FONTE: Record<FonteBitrix, string> = {
  bx24: 'BX24 (embutido no Bitrix)',
  webhook: 'Webhook REST (api_url)',
  nenhuma: 'nenhuma fonte configurada',
}

function serializar(valor: unknown): string {
  try {
    return JSON.stringify(valor, null, 2)
  } catch {
    return String(valor)
  }
}

function formatarRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutos = Math.round(diffMs / 60_000)
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `${minutos} min atrás`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `${horas} h atrás`
  return `${Math.round(horas / 24)} dia(s) atrás`
}

function SecaoSnapshot() {
  const metadata = useSyncExternalStore(
    assinarSnapshotDebug,
    lerSnapshotMetadataDebug,
    lerSnapshotMetadataDebug,
  )

  return (
    <div className={classes.chamada}>
      <Text fw={700} size="sm" c="white">
        Snapshot do sync-service (tarefas)
      </Text>
      {!metadata ? (
        <Text className={classes.vazio}>
          Nenhum snapshot lido ainda nesta sessão. Ele é buscado ao carregar os dados do dashboard.
        </Text>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            Sincronizado {formatarRelativo(metadata.syncedAt)} · janela {metadata.windowStart} a{' '}
            {metadata.windowEnd}
          </Text>
          <div className={classes.rotulo}>Tarefas por grupo</div>
          {metadata.groups.map((g) => (
            <Group key={g.id} justify="space-between" wrap="nowrap">
              <Text size="xs" c={g.error ? 'red.4' : 'dimmed'}>
                {g.nome} (#{g.id}){g.error ? ` · erro: ${g.error}` : ''}
              </Text>
              <Text size="xs" fw={700} c="white">
                {g.taskCount}
              </Text>
            </Group>
          ))}
        </>
      )}
    </div>
  )
}

function Chamada({ chamada }: { chamada: ChamadaCapturada }) {
  const totalItens = chamada.paginas.reduce((soma, p) => soma + p.quantidade, 0)

  return (
    <div className={classes.chamada}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div className={classes.metodo}>{chamada.method}</div>
        <Badge color={chamada.concluidaEm ? 'teal' : 'yellow'} variant="light" size="xs">
          {chamada.concluidaEm ? 'concluída' : 'em andamento'}
        </Badge>
      </Group>

      <Text size="xs" c="dimmed">
        {chamada.paginas.length} página(s) · {totalItens} item(ns) recebidos
        {chamada.total !== null ? ` · total no Bitrix: ${chamada.total}` : ''}
      </Text>

      <div className={classes.rotulo}>Parâmetros da request</div>
      <pre className={classes.bloco}>{serializar(chamada.params)}</pre>

      <div className={classes.rotulo}>Dados brutos por página (amostra)</div>
      {chamada.paginas.map((pagina, i) => (
        <div key={i} className={classes.pagina}>
          <Text size="xs" c="dimmed">
            start={pagina.start ?? 0} · {pagina.quantidade} item(ns)
          </Text>
          <pre className={classes.bloco}>{serializar(pagina.amostra)}</pre>
        </div>
      ))}
    </div>
  )
}

/**
 * Painel de diagnóstico do Bitrix — ícone flutuante no canto inferior direito,
 * visível SOMENTE em desenvolvimento (import.meta.env.DEV). As tarefas em si
 * vêm de um snapshot pré-sincronizado (sync-service) — a seção de snapshot
 * mostra quando/quanto foi sincronizado. As chamadas ao vivo restantes (grupos,
 * departamentos, identificação de usuário) continuam mostrando o rastro
 * completo de request/páginas abaixo.
 */
export function DebugBitrixPanel() {
  const [aberto, setAberto] = useState(false)
  const snapshot = useSyncExternalStore(assinarDebug, lerSnapshotDebug, lerSnapshotDebug)

  if (!debugBitrixAtivo) return null

  const fonte = ROTULO_FONTE[fonteAtiva()]
  const urlMascarada = apiUrlMascarada()

  return (
    <>
      {aberto && (
        <div className={classes.painel} role="dialog" aria-label="Diagnóstico Bitrix">
          <div className={classes.cabecalho}>
            <div>
              <Text fw={700} c="white" size="sm">
                Diagnóstico Bitrix (dev)
              </Text>
              <Text size="xs" c="dimmed">
                Fonte (acesso/departamentos): {fonte}
              </Text>
              {urlMascarada && (
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  api_url: {urlMascarada}
                </Text>
              )}
            </div>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Fechar diagnóstico"
              onClick={() => setAberto(false)}
            >
              ✕
            </ActionIcon>
          </div>

          <div className={classes.corpo}>
            <SecaoSnapshot />

            <div className={classes.rotulo}>Chamadas ao vivo (grupos, departamentos, usuário)</div>
            {snapshot.chamadas.length === 0 ? (
              <Text className={classes.vazio}>Nenhuma request capturada ainda.</Text>
            ) : (
              snapshot.chamadas.map((chamada) => <Chamada key={chamada.id} chamada={chamada} />)
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={classes.botao}
        aria-label="Abrir diagnóstico do Bitrix"
        title="Diagnóstico Bitrix (somente em dev)"
        onClick={() => setAberto((v) => !v)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m8 2 1.88 1.88" />
          <path d="M14.12 3.88 16 2" />
          <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
          <path d="M12 20v-9" />
          <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
          <path d="M6 13H2" />
          <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
          <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
          <path d="M22 13h-4" />
          <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
        </svg>
      </button>
    </>
  )
}
