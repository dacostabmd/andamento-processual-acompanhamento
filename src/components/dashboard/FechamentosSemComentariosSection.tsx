import { ActionIcon, Badge, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { AlertTriangle, Eye, MessageSquareOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import type { TarefaLink } from '../../services/aiAssistantService'
import { montarUrlTarefaBitrix } from '../../services/bitrixPortal'
import { type Tarefa } from '../../types/domain'
import { UserAvatar } from '../UserAvatar'
import { compararNumero, compararTexto } from './ordenacao'
import { ResultadoTarefasModal } from './ResultadoTarefasModal'
import { TabelaAnimadaPaginada, type ColunaTabelaAnimada } from './TabelaAnimadaPaginada'

interface FechamentosSemComentariosSectionProps {
  tarefasFiltradas: Tarefa[]
}

interface ColaboradorSemComentarios {
  id: number | null
  nome: string
  totalConcluidas: number
  semComentariosCount: number
  pctSemComentarios: number
  tarefasSemComentario: Tarefa[]
}

export function FechamentosSemComentariosSection({
  tarefasFiltradas,
}: FechamentosSemComentariosSectionProps) {
  const [modalTarefas, setModalTarefas] = useState<{
    titulo: string
    tarefas: Tarefa[]
  } | null>(null)

  const estatisticas = useMemo<ColaboradorSemComentarios[]>(() => {
    const mapa = new Map<
      string,
      {
        id: number | null
        nome: string
        totalConcluidas: number
        semComentarios: Tarefa[]
      }
    >()

    tarefasFiltradas.forEach((t) => {
      // Tarefa concluída
      if (t.status !== 5) return

      const nome =
        t.fechadoPorNome || t.responsavelAtendimentoNome || t.responsavelNome || 'Não informado'
      const id = t.fechadoPorId || t.responsavelAtendimentoId || t.responsavelId || null

      const atual = mapa.get(nome) ?? { id, nome, totalConcluidas: 0, semComentarios: [] }
      atual.totalConcluidas += 1

      if (!t.comentariosCount || t.comentariosCount === 0) {
        atual.semComentarios.push(t)
      }
      mapa.set(nome, atual)
    })

    const lista: ColaboradorSemComentarios[] = []
    mapa.forEach((item) => {
      if (item.semComentarios.length === 0) return
      const pct = (item.semComentarios.length / item.totalConcluidas) * 100
      lista.push({
        id: item.id,
        nome: item.nome,
        totalConcluidas: item.totalConcluidas,
        semComentariosCount: item.semComentarios.length,
        pctSemComentarios: pct,
        tarefasSemComentario: item.semComentarios,
      })
    })

    // Ordena pelo maior número de tarefas sem comentário
    return lista.sort(
      (a, b) =>
        b.semComentariosCount - a.semComentariosCount || b.pctSemComentarios - a.pctSemComentarios,
    )
  }, [tarefasFiltradas])

  const idsColaboradores = useMemo(() => {
    return estatisticas.map((r) => r.id).filter((id): id is number => typeof id === 'number')
  }, [estatisticas])

  const fotosMap = useFotosColaboradores(idsColaboradores)

  const colunas = useMemo<ColunaTabelaAnimada<ColaboradorSemComentarios>[]>(
    () => [
      {
        chave: 'posicao',
        rotulo: 'Ranking',
        className: 'w-20',
        render: (_, indiceGlobal) => (
          <Text fw={700} size="sm" c="yellow">
            {indiceGlobal}º
          </Text>
        ),
      },
      {
        chave: 'colaborador',
        rotulo: 'Vendedor / Colaborador',
        comparar: (a, b, direcao) => compararTexto(a.nome, b.nome, direcao),
        render: (item) => (
          <Group gap="sm" wrap="nowrap">
            <UserAvatar
              nome={item.nome}
              fotoUrl={item.id ? fotosMap.get(item.id) : null}
              size={28}
            />
            <Text size="sm" fw={500}>
              {item.nome}
            </Text>
          </Group>
        ),
      },
      {
        chave: 'totalConcluidas',
        rotulo: 'Total Concluídas',
        alinhamento: 'direita',
        comparar: (a, b, direcao) => compararNumero(a.totalConcluidas, b.totalConcluidas, direcao),
        render: (item) => (
          <Text size="sm" fw={500}>
            {item.totalConcluidas}
          </Text>
        ),
      },
      {
        chave: 'semComentarios',
        rotulo: 'Sem Atividade / Comentário',
        alinhamento: 'direita',
        comparar: (a, b, direcao) =>
          compararNumero(a.semComentariosCount, b.semComentariosCount, direcao),
        render: (item) => (
          <Group justify="flex-end" gap="xs">
            <Badge variant="light" color="orange" size="md">
              <Group gap={4} wrap="nowrap">
                <AlertTriangle size={13} />
                <span>{item.semComentariosCount} tarefa(s)</span>
              </Group>
            </Badge>
          </Group>
        ),
      },
      {
        chave: 'porcentagem',
        rotulo: '% do Total',
        alinhamento: 'direita',
        comparar: (a, b, direcao) =>
          compararNumero(a.pctSemComentarios, b.pctSemComentarios, direcao),
        render: (item) => (
          <Text size="sm" fw={700} c={item.pctSemComentarios > 50 ? 'red.4' : 'yellow.4'}>
            {item.pctSemComentarios.toFixed(1)}%
          </Text>
        ),
      },
    ],
    [fotosMap],
  )

  const tarefasLinkConvertidas = useMemo<TarefaLink[] | null>(() => {
    if (!modalTarefas) return null
    return modalTarefas.tarefas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      fechadoPorNome: t.fechadoPorNome ?? undefined,
      equipe: t.equipeAtendimento,
      finalizadoEm: t.finalizadoEm ?? undefined,
      link: montarUrlTarefaBitrix(t.id, t.projetoId, t.responsavelId) ?? null,
    }))
  }, [modalTarefas])

  return (
    <>
      <Card p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <div>
              <Group gap="xs" align="center">
                <MessageSquareOff size={20} style={{ color: 'var(--mantine-color-orange-4)' }} />
                <Text fw={700} size="lg">
                  Fechamentos Sem Atividade Comentada
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                Vendedores e colaboradores que concluíram tarefas sem nenhum comentário/atividade no
                Bitrix24
              </Text>
            </div>
            <Badge variant="dot" color="orange" size="md">
              {estatisticas.length} vendedor(es)
            </Badge>
          </Group>

          <TabelaAnimadaPaginada
            dados={estatisticas}
            colunas={colunas}
            chaveLinha={(item) => item.nome}
            ordenacaoInicial={{ chave: 'semComentarios', direcao: 'desc' }}
            itensPorPagina={10}
            onLinhaClique={(item) =>
              setModalTarefas({
                titulo: `Tarefas sem comentário — ${item.nome}`,
                tarefas: item.tarefasSemComentario,
              })
            }
            colunaAcao={{
              rotulo: 'Ver Tarefas',
              render: (item) => (
                <Tooltip label="Ver lista de tarefas sem comentário" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="yellow"
                    size="sm"
                    onClick={() =>
                      setModalTarefas({
                        titulo: `Tarefas sem comentário — ${item.nome}`,
                        tarefas: item.tarefasSemComentario,
                      })
                    }
                  >
                    <Eye size={15} />
                  </ActionIcon>
                </Tooltip>
              ),
            }}
            estadoVazio={{
              titulo: 'Nenhum fechamento sem comentário',
              descricao: 'Todas as tarefas concluídas possuem comentários registrados.',
            }}
          />
        </Stack>
      </Card>

      <ResultadoTarefasModal
        tarefas={tarefasLinkConvertidas}
        aoFechar={() => setModalTarefas(null)}
      />
    </>
  )
}
