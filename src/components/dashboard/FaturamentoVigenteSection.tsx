import {
  Badge,
  Card,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core'
import {
  BadgeCheck,
  CircleDollarSign,
  Clock,
  Coins,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import type { Tarefa, VisaoDashboard } from '../../types/domain'
import { idsColaboradoresDasTarefas } from '../../utils/pessoas'
import {
  calcularFaturamentoVigente,
  type DadosFaturamentoVigente,
} from '../../utils/tarefasMetrics'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { COR_POR_EQUIPE } from './tarefaApresentacao'

interface FaturamentoVigenteSectionProps {
  tarefas: Tarefa[]
  visao: VisaoDashboard
  aoSelecionarColaborador?: (colaborador: ColaboradorSelecionado) => void
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function FaturamentoVigenteSection({
  tarefas,
  visao,
  aoSelecionarColaborador,
}: FaturamentoVigenteSectionProps) {
  const dados: DadosFaturamentoVigente = useMemo(
    () => calcularFaturamentoVigente(tarefas, visao),
    [tarefas, visao],
  )

  const idsColaboradores = useMemo(() => idsColaboradoresDasTarefas(tarefas), [tarefas])
  const fotos = useFotosColaboradores(idsColaboradores)

  const pctRealizado =
    dados.totalGeral > 0 ? ((dados.totalRealizado / dados.totalGeral) * 100).toFixed(1) : '0'

  return (
    <section id="secao-faturamento-vigente" className="scroll-mt-6">
      <Stack gap="md">
        {/* Cabeçalho da Seção */}
        <Group justify="space-between" align="flex-end">
          <div>
            <Group gap="xs" mb={4}>
              <ThemeIcon size="lg" radius="md" color="teal" variant="light">
                <CircleDollarSign size={22} />
              </ThemeIcon>
              <Text fw={700} size="xl">
                Faturamento Vigente
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              Cruzamento financeiro de cobranças e pagamentos por tarefas, equipes e colaboradores.
            </Text>
          </div>
          <Badge size="lg" color="teal" variant="dot">
            {pctRealizado}% Pago do Total
          </Badge>
        </Group>

        {/* Banner de Explicação do Cálculo em Verde */}
        <Paper
          p="sm"
          radius="md"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <Group gap="xs" align="flex-start" wrap="nowrap">
            <ThemeIcon size="sm" color="teal" variant="light" radius="xl" style={{ marginTop: 2 }}>
              <CircleDollarSign size={14} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" fw={700} c="teal.4" tt="uppercase">
                Como o Faturamento é Calculado
              </Text>
              <Text size="xs" c="teal.3">
                O <strong>Faturamento Realizado</strong> soma os valores com pagamento confirmado no Asaas no CRM ou o valor de cobrança de tarefas concluídas. O <strong>Faturamento Pendente</strong> soma os valores de cobrança com pagamentos em aberto. O <strong>Ticket Médio</strong> divide o total realizado pela quantidade de tarefas pagas.
              </Text>
            </Stack>
          </Group>
        </Paper>

        {/* 4 Cards de Métricas Principais */}
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          {/* Card 1: Realizado */}
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  Faturamento Realizado
                </Text>
                <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
                  <BadgeCheck size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="xl" c="teal">
                {formatarMoeda(dados.totalRealizado)}
              </Text>
              <Text size="xs" c="dimmed">
                {dados.qtdPagos} tarefa(s) com pagamento confirmado
              </Text>
            </Stack>
          </Paper>

          {/* Card 2: Pendente */}
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  Faturamento Pendente
                </Text>
                <ThemeIcon size="sm" radius="xl" color="orange" variant="light">
                  <Clock size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="xl" c="orange">
                {formatarMoeda(dados.totalPendente)}
              </Text>
              <Text size="xs" c="dimmed">
                {dados.qtdPendentes} tarefa(s) a faturar/receber
              </Text>
            </Stack>
          </Paper>

          {/* Card 3: Total Geral */}
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  Faturamento Total
                </Text>
                <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                  <Wallet size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="xl">
                {formatarMoeda(dados.totalGeral)}
              </Text>
              <Text size="xs" c="dimmed">
                Volume financeiro total do recorte
              </Text>
            </Stack>
          </Paper>

          {/* Card 4: Ticket Médio */}
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  Ticket Médio
                </Text>
                <ThemeIcon size="sm" radius="xl" color="yellow" variant="light">
                  <Coins size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="xl" c="yellow">
                {formatarMoeda(dados.ticketMedio)}
              </Text>
              <Text size="xs" c="dimmed">
                Média de valor por tarefa paga
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Grade em 2 Colunas: Faturamento por Equipes e Top Faturadores */}
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          {/* Coluna 1: Faturamento por Equipe */}
          <Card
            padding="md"
            radius="md"
            withBorder
            style={{ backgroundColor: 'var(--superficie)' }}
          >
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <TrendingUp size={18} style={{ color: 'var(--mantine-color-teal-4)' }} />
                  <Text fw={700} size="sm">
                    Faturamento por Equipe de Atendimento
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Visão{' '}
                  {visao === 'executora' ? 'Executora (Fechador)' : 'Atendimento (Responsável)'}
                </Text>
              </Group>

              <Stack gap="md" mt="xs">
                {dados.porEquipe.map((eq) => {
                  const cor = COR_POR_EQUIPE[eq.equipe as keyof typeof COR_POR_EQUIPE] || '#94A3B8'
                  const pctEquipe = eq.total > 0 ? Math.round((eq.pago / eq.total) * 100) : 0

                  return (
                    <Paper
                      key={eq.equipe}
                      p="xs"
                      radius="sm"
                      withBorder
                      style={{ backgroundColor: 'var(--superficie-borda)' }}
                    >
                      <Stack gap={6}>
                        <Group justify="space-between" align="center">
                          <Group gap="xs">
                            <Badge
                              size="sm"
                              variant="light"
                              style={{ backgroundColor: `${cor}22`, color: cor }}
                            >
                              {eq.equipe}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              ({eq.qtdPago + eq.qtdPendente} tarefas)
                            </Text>
                          </Group>
                          <Text fw={700} size="sm" style={{ color: cor }}>
                            {formatarMoeda(eq.total)}
                          </Text>
                        </Group>

                        <Progress.Root size="sm" radius="xl">
                          <Progress.Section value={pctEquipe} color="teal">
                            <Progress.Label>{pctEquipe}%</Progress.Label>
                          </Progress.Section>
                          <Progress.Section value={100 - pctEquipe} color="orange" />
                        </Progress.Root>

                        <Group justify="space-between" align="center" mt={2}>
                          <Text size="xs" c="teal" fw={600}>
                            Pago: {formatarMoeda(eq.pago)} ({eq.qtdPago})
                          </Text>
                          <Text size="xs" c="orange" fw={600}>
                            Pendente: {formatarMoeda(eq.pendente)} ({eq.qtdPendente})
                          </Text>
                        </Group>
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            </Stack>
          </Card>

          {/* Coluna 2: Top Faturadores (Colaboradores) */}
          <Card
            padding="md"
            radius="md"
            withBorder
            style={{ backgroundColor: 'var(--superficie)' }}
          >
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <UserCheck size={18} style={{ color: 'var(--mantine-color-blue-4)' }} />
                  <Text fw={700} size="sm">
                    Maiores Faturadores por Colaborador
                  </Text>
                </Group>
                <Badge size="xs" color="blue" variant="light">
                  Top 10 Fechadores
                </Badge>
              </Group>

              {dados.topFechadores.length === 0 ? (
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                  Nenhum registro de faturamento encontrado no recorte atual.
                </Text>
              ) : (
                <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: '36px' }}>#</Table.Th>
                      <Table.Th>Colaborador</Table.Th>
                      <Table.Th>Equipe</Table.Th>
                      <Table.Th style={{ width: '80px' }}>Tarefas</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Total Realizado</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dados.topFechadores.map((f, i) => {
                      const tarefasDoColab = tarefas.filter(
                        (t) =>
                          t.fechadoPorNome === f.nome ||
                          t.responsavelAtendimentoNome === f.nome ||
                          t.responsavelNome === f.nome,
                      )
                      const colabId =
                        tarefasDoColab[0]?.fechadoPorId ||
                        tarefasDoColab[0]?.responsavelAtendimentoId ||
                        tarefasDoColab[0]?.responsavelId ||
                        undefined

                      return (
                        <Table.Tr
                          key={f.nome}
                          style={{ cursor: aoSelecionarColaborador ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (aoSelecionarColaborador) {
                              aoSelecionarColaborador({
                                nome: f.nome,
                                equipe: f.equipe as any,
                                papel:
                                  visao === 'executora'
                                    ? 'Fechado por'
                                    : 'Responsável pelo atendimento',
                                cards: tarefasDoColab,
                              })
                            }
                          }}
                        >
                          <Table.Td>
                            <Text size="xs" fw={700} c="dimmed">
                              {i + 1}º
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap" align="center">
                              <UserAvatar
                                nome={f.nome}
                                fotoUrl={fotos.get(colabId ?? 0)}
                                size={32}
                              />
                              <Text size="xs" fw={600} lineClamp={1}>
                                {f.nome}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="sm"
                              variant="light"
                              color={f.equipe === 'indefinido' ? 'gray' : undefined}
                              style={
                                f.equipe === 'indefinido'
                                  ? undefined
                                  : {
                                      backgroundColor: `${COR_POR_EQUIPE[f.equipe as keyof typeof COR_POR_EQUIPE]}22`,
                                      color:
                                        COR_POR_EQUIPE[f.equipe as keyof typeof COR_POR_EQUIPE],
                                    }
                              }
                            >
                              {f.equipe}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {f.qtdTarefas} card(s)
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" fw={700} c="teal">
                              {formatarMoeda(f.totalPago)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </section>
  )
}
