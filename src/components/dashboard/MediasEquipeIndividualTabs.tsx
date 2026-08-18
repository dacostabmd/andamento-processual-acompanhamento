import { Badge, Group, Text, UnstyledButton } from '@mantine/core'
import { useMemo } from 'react'
import { type PacoteAtendimento, type Tarefa } from '../../types/domain'
import { calcularRankingFechadores } from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { COR_POR_EQUIPE } from './tarefaApresentacao'

interface MediasEquipeIndividualTabsProps {
  pacotes: PacoteAtendimento[]
  tarefasFiltradas: Tarefa[]
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}

export function MediasEquipeIndividualTabs({
  pacotes,
  tarefasFiltradas,
  onSelecionarColaborador,
}: MediasEquipeIndividualTabsProps) {
  const ranking = useMemo(() => calcularRankingFechadores(tarefasFiltradas), [tarefasFiltradas])

  if (pacotes.length === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados para exibir"
        descricao="Ajuste os filtros para visualizar as médias por equipe e o desempenho individual."
      />
    )
  }

  return (
    <div className="max-h-[420px] overflow-y-auto pr-1">
      <div className="flex flex-col gap-1">
        {ranking.linhas.map((linha, index) => (
          <UnstyledButton
            key={linha.fechadoPorId}
            onClick={() =>
              onSelecionarColaborador({
                nome: linha.nome,
                equipe: linha.equipe,
                papel: 'Fechado por',
                cards: tarefasFiltradas.filter((t) => t.fechadoPorId === linha.fechadoPorId),
              })
            }
            className="item-clicavel-hover"
            style={{
              borderRadius: 'var(--mantine-radius-sm)',
              padding: '8px 10px',
              border: '1px solid var(--superficie-borda)',
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Text size="xs" fw={700} c="dimmed" style={{ minWidth: 24, textAlign: 'right' }}>
                  {index + 1}º
                </Text>
                <UserAvatar nome={linha.nome} size={30} />
                <Text size="sm" lineClamp={1} style={{ minWidth: 0 }}>
                  {linha.nome}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={linha.equipe === 'indefinido' ? 'gray' : undefined}
                  style={
                    linha.equipe === 'indefinido'
                      ? undefined
                      : {
                          backgroundColor: `${COR_POR_EQUIPE[linha.equipe]}22`,
                          color: COR_POR_EQUIPE[linha.equipe],
                        }
                  }
                >
                  {linha.equipe}
                </Badge>
              </Group>
              <Group gap="md" wrap="nowrap">
                <Text size="xs" c="dimmed" className="tabular-nums whitespace-nowrap">
                  {linha.noPrazo} no prazo · {linha.comAtraso} atraso
                </Text>
                <Text size="sm" fw={700} className="tabular-nums">
                  {linha.total}
                </Text>
              </Group>
            </Group>
          </UnstyledButton>
        ))}
      </div>
    </div>
  )
}
