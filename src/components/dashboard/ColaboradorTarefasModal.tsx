import { ActionIcon, Badge, Modal, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useMemo, useState } from 'react'
import { montarUrlTarefaBitrix } from '../../services/bitrixPortal'
import { STATUS_LABELS, type EquipeAtendimento, type Tarefa } from '../../types/domain'
import { contarSituacoes, tarefaEstaAtrasada, tarefaEstaConcluida } from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import { TarefaDetalheModal } from './TarefaDetalheModal'
import { COR_POR_EQUIPE, COR_POR_SITUACAO, corDoStatus, formatarData, formatarDataHora } from './tarefaApresentacao'

export interface ColaboradorSelecionado {
  nome: string
  equipe: EquipeAtendimento
  /** Rótulo do papel já resolvido pelo caller — ex.: "Responsável pelo atendimento" ou "Fechado por". */
  papel: string
  cards: Tarefa[]
}

interface ColaboradorTarefasModalProps {
  colaborador: ColaboradorSelecionado | null
  aoFechar: () => void
}

const SITUACOES_BREAKDOWN: Array<{ chave: keyof typeof COR_POR_SITUACAO; label: string }> = [
  { chave: 'noPrazo', label: 'No prazo' },
  { chave: 'atrasadas', label: 'Atrasadas' },
  { chave: 'concluidas', label: 'Concluídas' },
  { chave: 'adiadas', label: 'Adiadas' },
]

export function ColaboradorTarefasModal({ colaborador, aoFechar }: ColaboradorTarefasModalProps) {
  const [tarefaDetalhe, setTarefaDetalhe] = useState<Tarefa | null>(null)

  const contagem = useMemo(
    () => (colaborador ? contarSituacoes(colaborador.cards) : null),
    [colaborador],
  )

  // Mais críticas primeiro: ajuda a achar o que precisa de atenção sem rolar tudo.
  const cardsOrdenados = useMemo(() => {
    if (!colaborador) return []
    const agora = new Date()
    const pesoSituacao = (t: Tarefa): number => {
      if (tarefaEstaAtrasada(t, agora)) return 0
      if (tarefaEstaConcluida(t)) return 2
      if (t.status === 6) return 3
      return 1 // no prazo
    }
    return [...colaborador.cards].sort((a, b) => pesoSituacao(a) - pesoSituacao(b))
  }, [colaborador])

  return (
    <>
      <Modal
        opened={colaborador !== null}
        onClose={aoFechar}
        title="Tarefas contabilizadas"
        centered
        size="auto"
        styles={{ content: { width: 'min(900px, calc(100vw - 2rem))' } }}
        radius="md"
        transitionProps={{ transition: 'slide-up', duration: 250 }}
      >
        {colaborador && contagem && (
          <Stack gap="md">
            <div>
              <Text fw={700} size="lg">
                {colaborador.nome}
              </Text>
              <Badge
                mt={4}
                size="sm"
                variant="light"
                color={colaborador.equipe === 'indefinido' ? 'gray' : undefined}
                style={
                  colaborador.equipe === 'indefinido'
                    ? undefined
                    : {
                        backgroundColor: `${COR_POR_EQUIPE[colaborador.equipe]}22`,
                        color: COR_POR_EQUIPE[colaborador.equipe],
                      }
                }
              >
                {colaborador.equipe}
              </Badge>
              <Text size="xs" c="dimmed" mt={4}>
                {colaborador.papel} · {colaborador.cards.length} tarefa(s) no recorte de filtros atual
              </Text>
            </div>

            <SimpleGrid cols={4}>
              {SITUACOES_BREAKDOWN.map((s) => (
                <div key={s.chave}>
                  <Text size="xl" fw={700} style={{ color: COR_POR_SITUACAO[s.chave] }}>
                    {contagem[s.chave]}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {s.label}
                  </Text>
                </div>
              ))}
            </SimpleGrid>

            {cardsOrdenados.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma tarefa encontrada"
                descricao="Não há tarefas contabilizadas para esta pessoa no recorte de filtros atual."
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-auto pr-1">
                <table className="w-full min-w-[600px] border-collapse text-sm table-fixed">
                  <colgroup>
                    <col />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col className="w-32" />
                    <col className="w-12" />
                  </colgroup>
                  <thead
                    className="sticky top-0 z-10"
                    style={{ backgroundColor: 'var(--superficie)' }}
                  >
                    <tr style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                      <th className="px-2 py-2 text-left font-semibold opacity-70">Título</th>
                      <th className="px-2 py-2 text-left font-semibold opacity-70">Status</th>
                      <th className="px-2 py-2 text-left font-semibold opacity-70">Prazo</th>
                      <th className="px-2 py-2 text-left font-semibold opacity-70">
                        Finalizado em
                      </th>
                      <th className="px-2 py-2 text-center font-semibold opacity-70">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardsOrdenados.map((tarefa) => {
                      const urlBitrix = montarUrlTarefaBitrix(tarefa.id)
                      return (
                        <tr key={tarefa.id} style={{ borderBottom: '1px solid var(--superficie-borda)' }}>
                          <td className="px-2 py-2">
                            <UnstyledButton onClick={() => setTarefaDetalhe(tarefa)}>
                              <Text size="sm" lineClamp={1} className="hover:underline" style={{ cursor: 'pointer' }}>
                                {tarefa.titulo}
                              </Text>
                            </UnstyledButton>
                          </td>
                          <td className="px-2 py-2">
                            <Badge size="sm" color={corDoStatus(tarefa)} variant="light">
                              {STATUS_LABELS[tarefa.status]}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <Text size="xs">{formatarData(tarefa.prazoFinal)}</Text>
                          </td>
                          <td className="px-2 py-2">
                            <Text size="xs">{formatarDataHora(tarefa.finalizadoEm)}</Text>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-center">
                              {urlBitrix && (
                                <Tooltip label="Abrir no Bitrix" withArrow>
                                  <ActionIcon
                                    component="a"
                                    href={urlBitrix}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
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
                            </div>
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
      </Modal>

      <TarefaDetalheModal tarefa={tarefaDetalhe} aoFechar={() => setTarefaDetalhe(null)} />
    </>
  )
}
