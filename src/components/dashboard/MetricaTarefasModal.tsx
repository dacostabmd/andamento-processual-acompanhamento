import {
  ActionIcon,
  Badge,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useMemo, useState } from 'react'
import { montarCaminhoTarefaBitrix, montarUrlTarefaBitrix } from '../../services/bitrixPortal'
import { abrirNoPortal } from '../../services/bitrixSdk'
import { STATUS_LABELS, type Tarefa } from '../../types/domain'
import { tarefaFoiConcluidaComAtraso } from '../../utils/tarefasMetrics'
import { CabecalhoOrdenavel } from './CabecalhoOrdenavel'
import { pesoSituacao } from './ColaboradorTarefasModal'
import { compararData, compararNumero, compararTexto, useOrdenacaoTabela } from './ordenacao'
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

type ColunaMetrica = 'titulo' | 'situacao' | 'prazo' | 'finalizado'

function normalizarBusca(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
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
  const { ordem, setOrdem, alternar } = useOrdenacaoTabela<ColunaMetrica>({
    chave: 'situacao',
    direcao: 'asc',
  })

  const tarefasOrdenadas = useMemo(() => {
    if (!metrica) return []
    const agora = new Date()
    const { chave, direcao } = ordem
    const comparar = (a: Tarefa, b: Tarefa): number => {
      switch (chave) {
        case 'titulo':
          return compararTexto(a.titulo, b.titulo, direcao)
        case 'prazo':
          return compararData(a.prazoFinal, b.prazoFinal, direcao)
        case 'finalizado':
          return compararData(a.finalizadoEm, b.finalizadoEm, direcao)
        default:
          return compararNumero(pesoSituacao(a, agora), pesoSituacao(b, agora), direcao)
      }
    }
    return [...metrica.tarefas].sort(
      (a, b) => comparar(a, b) || compararTexto(a.titulo, b.titulo, 'asc') || a.id - b.id,
    )
  }, [metrica, ordem])

  const tarefasFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    if (!termo) return tarefasOrdenadas
    return tarefasOrdenadas.filter((t) => normalizarBusca(t.titulo).includes(termo))
  }, [tarefasOrdenadas, busca])

  return (
    <>
      <Modal
        opened={metrica !== null}
        onClose={aoFechar}
        zIndex={1000}
        onExitTransitionEnd={() => {
          setBusca('')
          setOrdem({ chave: 'situacao', direcao: 'asc' })
        }}
        title={metrica?.titulo ?? 'Tarefas'}
        centered
        size="auto"
        styles={{ content: { width: 'min(900px, calc(100vw - 2rem))' } }}
        radius="md"
        transitionProps={{ transition: 'slide-up', duration: 250 }}
      >
        {metrica && (
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              {metrica.subtitulo ??
                `${metrica.tarefas.length} tarefa(s) no recorte de filtros atual`}
            </Text>

            {tarefasOrdenadas.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma tarefa encontrada"
                descricao="Não há tarefas contabilizadas para este recorte."
              />
            ) : (
              <Stack gap="sm">
                <TextInput
                  placeholder="Buscar por título da tarefa…"
                  value={busca}
                  onChange={(e) => setBusca(e.currentTarget.value)}
                  size="xs"
                />

                {tarefasFiltradas.length === 0 ? (
                  <Text size="sm" c="dimmed" py="md">
                    Nenhuma tarefa encontrada para "{busca}".
                  </Text>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto overflow-x-auto pr-1">
                    <table className="w-full min-w-[700px] border-collapse text-sm table-fixed">
                      <colgroup>
                        <col />
                        <col className="w-36" />
                        <col className="w-24" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-12" />
                      </colgroup>
                      <thead
                        className="sticky top-0 z-10"
                        style={{ backgroundColor: 'var(--superficie)' }}
                      >
                        <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                          <CabecalhoOrdenavel
                            chave="titulo"
                            rotulo="Título"
                            ordem={ordem}
                            aoOrdenar={alternar}
                          />
                          <th className="px-2 py-2 text-left font-semibold opacity-70">Equipe</th>
                          <CabecalhoOrdenavel
                            chave="situacao"
                            rotulo="Status"
                            ordem={ordem}
                            aoOrdenar={alternar}
                          />
                          <CabecalhoOrdenavel
                            chave="prazo"
                            rotulo="Prazo"
                            ordem={ordem}
                            aoOrdenar={alternar}
                          />
                          <CabecalhoOrdenavel
                            chave="finalizado"
                            rotulo="Finalizado em"
                            ordem={ordem}
                            aoOrdenar={alternar}
                            direcaoInicial="desc"
                          />
                          <th className="px-2 py-2 text-center font-semibold opacity-70">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tarefasFiltradas.map((tarefa) => {
                          const urlBitrix = montarUrlTarefaBitrix(
                            tarefa.id,
                            tarefa.projetoId,
                            tarefa.responsavelId,
                          )
                          const caminhoBitrix = montarCaminhoTarefaBitrix(
                            tarefa.id,
                            tarefa.projetoId,
                            tarefa.responsavelId,
                          )
                          return (
                            <tr
                              key={tarefa.id}
                              style={{ borderBottom: '1px solid var(--superficie-borda)' }}
                            >
                              <td className="px-2 py-2">
                                <UnstyledButton onClick={() => setTarefaDetalhe(tarefa)}>
                                  <Text
                                    size="sm"
                                    lineClamp={1}
                                    className="item-clicavel-hover"
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {tarefa.titulo}
                                  </Text>
                                </UnstyledButton>
                              </td>
                              <td className="px-2 py-2">
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={
                                    tarefa.equipeAtendimento === 'indefinido' ? 'gray' : undefined
                                  }
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
                              </td>
                              <td className="px-2 py-2">
                                <Badge
                                  size="sm"
                                  color={
                                    tarefaFoiConcluidaComAtraso(tarefa)
                                      ? 'orange'
                                      : corDoStatus(tarefa)
                                  }
                                  variant="light"
                                >
                                  {tarefaFoiConcluidaComAtraso(tarefa)
                                    ? 'Concluído com atraso'
                                    : STATUS_LABELS[tarefa.status]}
                                </Badge>
                              </td>
                              <td className="px-2 py-2">
                                <Text size="sm">{formatarData(tarefa.prazoFinal)}</Text>
                              </td>
                              <td className="px-2 py-2">
                                <Text size="sm">{formatarDataHora(tarefa.finalizadoEm)}</Text>
                              </td>
                              <td className="px-2 py-2 text-center">
                                {urlBitrix && caminhoBitrix && (
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
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
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
