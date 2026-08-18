import { ActionIcon, Badge, Group, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useMemo, useState } from 'react'
import { montarCaminhoTarefaBitrix, montarUrlTarefaBitrix } from '../../services/bitrixPortal'
import { abrirNoPortal } from '../../services/bitrixSdk'
import { STATUS_LABELS, type Tarefa } from '../../types/domain'
import { tarefaFoiConcluidaComAtraso } from '../../utils/tarefasMetrics'
import { BotaoExportarWhatsApp } from './BotaoExportarWhatsApp'
import { pesoSituacao } from './ColaboradorTarefasModal'
import { compararData, compararNumero, compararTexto } from './ordenacao'
import { TabelaAnimadaPaginada, type ColunaTabelaAnimada } from './TabelaAnimadaPaginada'
import { TarefaDetalheModal } from './TarefaDetalheModal'
import { COR_POR_EQUIPE, corDoStatus, formatarData, formatarDataHora } from './tarefaApresentacao'
import { EstadoVazio } from '../EstadoVazio'

export interface MetricaSelecionada {
  /** Título do que foi clicado — ex.: "Estado: SP", "Urgência: Vencidas", "Concluídas em jan/26". */
  titulo: string
  /** Frase curta de contexto, ex.: o critério exato usado no recorte. */
  subtitulo?: string
  tarefas: Tarefa[]
}

interface MetricaTarefasModalProps {
  metrica: MetricaSelecionada | null
  aoFechar: () => void
}

function normalizarBusca(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Colunas fora do componente: não dependem de props/estado, então não há
 * motivo para recriá-las a cada render (a tabela já reordena e pagina por
 * conta própria a partir de `comparar`).
 */
function criarColunas(aoAbrirDetalhe: (tarefa: Tarefa) => void): ColunaTabelaAnimada<Tarefa>[] {
  return [
    {
      chave: 'titulo',
      rotulo: 'Título',
      comparar: (a, b, d) => compararTexto(a.titulo, b.titulo, d),
      render: (tarefa) => (
        <Text
          size="sm"
          lineClamp={1}
          className="item-clicavel-hover"
          style={{ cursor: 'pointer' }}
          onClick={() => aoAbrirDetalhe(tarefa)}
        >
          {tarefa.titulo}
        </Text>
      ),
    },
    {
      chave: 'responsavel',
      rotulo: 'Responsável',
      comparar: (a, b, d) =>
        compararTexto(
          a.responsavelAtendimentoNome || a.responsavelNome || 'Não informado',
          b.responsavelAtendimentoNome || b.responsavelNome || 'Não informado',
          d,
        ),
      render: (tarefa) => (
        <Text size="sm" lineClamp={1} fw={500}>
          {tarefa.responsavelAtendimentoNome || tarefa.responsavelNome || 'Não informado'}
        </Text>
      ),
    },
    {
      chave: 'equipe',
      rotulo: 'Equipe do Resp.',
      comparar: (a, b, d) => compararTexto(a.equipeAtendimento, b.equipeAtendimento, d),
      render: (tarefa) => (
        <Badge
          size="sm"
          variant="light"
          color={tarefa.equipeAtendimento === 'indefinido' ? 'gray' : undefined}
          style={
            tarefa.equipeAtendimento === 'indefinido'
              ? undefined
              : {
                  backgroundColor: `${COR_POR_EQUIPE[tarefa.equipeAtendimento]}22`,
                  color: COR_POR_EQUIPE[tarefa.equipeAtendimento],
                }
          }
        >
          {tarefa.equipeAtendimento}
        </Badge>
      ),
    },
    {
      chave: 'situacao',
      rotulo: 'Status',
      comparar: (a, b, d) => {
        const agora = new Date()
        return compararNumero(pesoSituacao(a, agora), pesoSituacao(b, agora), d)
      },
      render: (tarefa) => (
        <Badge
          size="sm"
          color={tarefaFoiConcluidaComAtraso(tarefa) ? 'orange' : corDoStatus(tarefa)}
          variant="light"
        >
          {tarefaFoiConcluidaComAtraso(tarefa)
            ? 'Concluído com atraso'
            : STATUS_LABELS[tarefa.status]}
        </Badge>
      ),
    },
    {
      chave: 'prazo',
      rotulo: 'Prazo',
      comparar: (a, b, d) => compararData(a.prazoFinal, b.prazoFinal, d),
      render: (tarefa) => <Text size="sm">{formatarData(tarefa.prazoFinal)}</Text>,
    },
    {
      chave: 'finalizado',
      rotulo: 'Finalizado em',
      direcaoInicial: 'desc',
      comparar: (a, b, d) => compararData(a.finalizadoEm, b.finalizadoEm, d),
      render: (tarefa) => <Text size="sm">{formatarDataHora(tarefa.finalizadoEm)}</Text>,
    },
  ]
}

/**
 * Tarefas por trás de um clique num gráfico de `GraficosInteligencia` (UF,
 * urgência, tendência mensal) — diferente de `ColaboradorTarefasModal`
 * (sempre as tarefas de UMA pessoa identificada), aqui o recorte pode
 * atravessar várias pessoas e equipes ao mesmo tempo, então cada linha traz o
 * próprio badge de equipe em vez de um cabeçalho único de "dono" do recorte.
 */
export function MetricaTarefasModal({ metrica, aoFechar }: MetricaTarefasModalProps) {
  const [tarefaDetalhe, setTarefaDetalhe] = useState<Tarefa | null>(null)
  const [busca, setBusca] = useState('')

  const colunas = useMemo(() => criarColunas((tarefa) => setTarefaDetalhe(tarefa)), [])

  const tarefasFiltradas = useMemo(() => {
    if (!metrica) return []
    const termo = normalizarBusca(busca)
    if (!termo) return metrica.tarefas
    return metrica.tarefas.filter((t) => {
      const tituloMatch = normalizarBusca(t.titulo ?? '').includes(termo)
      const respMatch = normalizarBusca(
        t.responsavelAtendimentoNome || t.responsavelNome || '',
      ).includes(termo)
      const equipeMatch = normalizarBusca(t.equipeAtendimento ?? '').includes(termo)
      return tituloMatch || respMatch || equipeMatch
    })
  }, [metrica, busca])

  return (
    <>
      <Modal
        opened={metrica !== null}
        onClose={aoFechar}
        zIndex={1000}
        onExitTransitionEnd={() => setBusca('')}
        title={metrica?.titulo ?? 'Tarefas'}
        centered
        size="auto"
        styles={{ content: { width: 'min(1050px, calc(100vw - 2rem))' } }}
        radius="md"
        transitionProps={{ transition: 'slide-up', duration: 250 }}
      >
        {metrica && (
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="xs" c="dimmed">
                {metrica.subtitulo ??
                  `${metrica.tarefas.length} tarefa(s) no recorte de filtros atual`}
              </Text>
              <BotaoExportarWhatsApp titulo={metrica.titulo} tarefas={metrica.tarefas} />
            </Group>

            {metrica.tarefas.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma tarefa encontrada"
                descricao="Não há tarefas contabilizadas para este recorte."
              />
            ) : (
              <Stack gap="sm">
                <TextInput
                  placeholder="Buscar por título, responsável ou equipe…"
                  value={busca}
                  onChange={(e) => setBusca(e.currentTarget.value)}
                  size="xs"
                />

                {tarefasFiltradas.length === 0 ? (
                  <Text size="sm" c="dimmed" py="md">
                    Nenhuma tarefa encontrada para "{busca}".
                  </Text>
                ) : (
                  <TabelaAnimadaPaginada
                    dados={tarefasFiltradas}
                    colunas={colunas}
                    chaveLinha={(tarefa) => tarefa.id}
                    ordenacaoInicial={{ chave: 'situacao', direcao: 'asc' }}
                    itensPorPagina={15}
                    colunaAcao={{
                      rotulo: 'Ação',
                      render: (tarefa) => {
                        const urlBitrix = montarUrlTarefaBitrix(
                          tarefa.id,
                          tarefa.projetoId,
                          tarefa.responsavelId,
                          tarefa.fechadoPorId,
                          tarefa.responsavelAtendimentoId,
                        )
                        const caminhoBitrix = montarCaminhoTarefaBitrix(
                          tarefa.id,
                          tarefa.projetoId,
                          tarefa.responsavelId,
                          tarefa.fechadoPorId,
                          tarefa.responsavelAtendimentoId,
                        )
                        if (!urlBitrix || !caminhoBitrix) return null
                        return (
                          <Tooltip label="Abrir tarefa no Bitrix" withArrow>
                            <ActionIcon
                              component="button"
                              type="button"
                              onClick={() => abrirNoPortal(caminhoBitrix, urlBitrix)}
                              variant="subtle"
                              size="sm"
                              aria-label="Abrir tarefa no Bitrix"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <path d="M15 3h6v6" />
                                <path d="M10 14 21 3" />
                              </svg>
                            </ActionIcon>
                          </Tooltip>
                        )
                      },
                    }}
                  />
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Modal>

      <TarefaDetalheModal tarefa={tarefaDetalhe} aoFechar={() => setTarefaDetalhe(null)} />
    </>
  )
}
