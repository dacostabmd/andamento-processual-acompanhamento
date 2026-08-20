import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  BarChart3,
  Briefcase,
  Check,
  ClipboardList,
  Crown,
  DollarSign,
  Laptop,
  Settings,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { salvarPermissoesMetricas } from '../../services/permissoesApi'
import type { CargoRole, Colaborador, PerfilVisibilidadeMetricas, PermissoesMetricas } from '../../types/domain'

interface PermissoesMetricasPanelProps {
  aberto: boolean
  colaborador: Colaborador | null
  perfis: PerfilVisibilidadeMetricas[]
  onFechar: () => void
  onAtualizado: () => void
}

const NOME_CARGO: Record<CargoRole, string> = {
  ceo: 'CEO / Alta Gestão',
  diretor: 'Diretoria Executiva',
  coordenador: 'Coordenação de Equipes',
  operacional: 'Operacional / Analistas',
}

const DESCRICAO_CARGO: Record<CargoRole, string> = {
  ceo: 'Acesso total e irrestrito a todas as métricas estratégicas, financeiras e configurações.',
  diretor: 'Visão executiva completa de faturamento, prazos e rankings de produção.',
  coordenador: 'Foco no acompanhamento de equipe, pontualidade individual e projeções de vazão.',
  operacional: 'Visão limitada a rankings operacionais e médias básicas de produção.',
}

export function PermissoesMetricasPanel({
  aberto,
  colaborador,
  perfis,
  onFechar,
  onAtualizado,
}: PermissoesMetricasPanelProps) {
  const [cargoAtivo, setCargoAtivo] = useState<CargoRole>('ceo')
  const [permissoesAtuais, setPermissoesAtuais] = useState<PermissoesMetricas | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const perfil = perfis.find((p) => p.cargoRole === cargoAtivo)
    if (perfil) {
      setPermissoesAtuais(perfil.permissoes)
    }
  }, [cargoAtivo, perfis])

  function alternarToggle(chave: keyof PermissoesMetricas, valor: boolean) {
    if (!permissoesAtuais) return
    setPermissoesAtuais({ ...permissoesAtuais, [chave]: valor })
  }

  async function aoSalvar() {
    if (!permissoesAtuais) return
    setSalvando(true)
    try {
      await salvarPermissoesMetricas(cargoAtivo, permissoesAtuais, colaborador)
      notifications.show({
        color: 'teal',
        title: 'Permissões atualizadas',
        message: `As configurações de visibilidade para ${NOME_CARGO[cargoAtivo]} foram salvas.`,
        icon: <Check size={16} />,
      })
      onAtualizado()
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Falha ao salvar permissões',
        message: e instanceof Error ? e.message : 'Erro ao atualizar as permissões do perfil.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      opened={aberto}
      onClose={onFechar}
      title={
        <Group gap="xs">
          <ShieldCheck size={20} color="var(--mantine-color-grape-4)" />
          <Title order={4}>Visibilidade de Métricas & Permissões</Title>
          <Badge color="grape" variant="light">
            Super Admin
          </Badge>
        </Group>
      }
      size="xl"
      centered
      radius="md"
    >
      <Text size="xs" c="dimmed" mb="md">
        Configure quais métricas, gráficos e painéis cada perfil de usuário pode visualizar no
        dashboard. Os toggles controlam dinamicamente a renderização dos componentes na tela.
      </Text>

      <Tabs value={cargoAtivo} onChange={(val) => setCargoAtivo(val as CargoRole)}>
        <Tabs.List mb="md">
          <Tabs.Tab value="ceo" leftSection={<Crown size={15} color="#eab308" />}>
            CEO
          </Tabs.Tab>
          <Tabs.Tab value="diretor" leftSection={<Briefcase size={15} color="#3b82f6" />}>
            Diretor
          </Tabs.Tab>
          <Tabs.Tab value="coordenador" leftSection={<ClipboardList size={15} color="#10b981" />}>
            Coordenador
          </Tabs.Tab>
          <Tabs.Tab value="operacional" leftSection={<Laptop size={15} color="#8b5cf6" />}>
            Operacional
          </Tabs.Tab>
        </Tabs.List>

        {permissoesAtuais && (
          <Stack gap="md">
            <Alert color="indigo" variant="light">
              <Text size="xs" fw={700}>
                {NOME_CARGO[cargoAtivo]}
              </Text>
              <Text size="xs">{DESCRICAO_CARGO[cargoAtivo]}</Text>
            </Alert>

            <Group gap="xs" mt="xs">
              <DollarSign size={16} color="#eab308" />
              <Text size="sm" fw={700}>
                Métricas Financeiras
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Card padding="sm" radius="sm">
                <Switch
                  label="Faturamento Vigente Total"
                  description="Exibe totais realizados, pendentes e ticket médio"
                  checked={permissoesAtuais.faturamentoVigente}
                  onChange={(e) => alternarToggle('faturamentoVigente', e.currentTarget.checked)}
                />
              </Card>

              <Card padding="sm" radius="sm">
                <Switch
                  label="Detalhamento Asaas"
                  description="Exibe cobranças recebidas e pendentes do CRM"
                  checked={permissoesAtuais.detalhamentoAsaas}
                  onChange={(e) => alternarToggle('detalhamentoAsaas', e.currentTarget.checked)}
                />
              </Card>
            </SimpleGrid>

            <Group gap="xs" mt="xs">
              <BarChart3 size={16} color="#3b82f6" />
              <Text size="sm" fw={700}>
                Métricas de Desempenho & Produção
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Card padding="sm" radius="sm">
                <Switch
                  label="Ranking Geral de Fechadores"
                  description="Tabela completa com volume e pontualidade de fechamento"
                  checked={permissoesAtuais.rankingFechadores}
                  onChange={(e) => alternarToggle('rankingFechadores', e.currentTarget.checked)}
                />
              </Card>

              <Card padding="sm" radius="sm">
                <Switch
                  label="Desempenho Individual"
                  description="Cartões individuais por responsável no prazo vs com atraso"
                  checked={permissoesAtuais.desempenhoIndividual}
                  onChange={(e) => alternarToggle('desempenhoIndividual', e.currentTarget.checked)}
                />
              </Card>
            </SimpleGrid>

            <Group gap="xs" mt="xs">
              <TrendingUp size={16} color="#10b981" />
              <Text size="sm" fw={700}>
                Projeções Estatísticas & Tendências
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Card padding="sm" radius="sm">
                <Switch
                  label="Simulação Monte Carlo"
                  description="Previsão probabilística P10/P50/P90"
                  checked={permissoesAtuais.projecaoMonteCarlo}
                  onChange={(e) => alternarToggle('projecaoMonteCarlo', e.currentTarget.checked)}
                />
              </Card>

              <Card padding="sm" radius="sm">
                <Switch
                  label="Regressão Linear (OLS)"
                  description="Tendência matemática constante y=ax+b"
                  checked={permissoesAtuais.projecaoRegressaoLinear}
                  onChange={(e) =>
                    alternarToggle('projecaoRegressaoLinear', e.currentTarget.checked)
                  }
                />
              </Card>

              <Card padding="sm" radius="sm">
                <Switch
                  label="Média Móvel"
                  description="Linha de referência constante recente"
                  checked={permissoesAtuais.projecaoMediaMovel}
                  onChange={(e) => alternarToggle('projecaoMediaMovel', e.currentTarget.checked)}
                />
              </Card>
            </SimpleGrid>

            <Group gap="xs" mt="xs">
              <Settings size={16} color="#8b5cf6" />
              <Text size="sm" fw={700}>
                Painéis de Gestão e Auditoria
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Card padding="sm" radius="sm">
                <Switch
                  label="Gestão de Cadastro de Equipes"
                  description="Permite criar, editar e organizar equipes"
                  checked={permissoesAtuais.gestaoEquipes}
                  onChange={(e) => alternarToggle('gestaoEquipes', e.currentTarget.checked)}
                />
              </Card>

              <Card padding="sm" radius="sm">
                <Switch
                  label="Auditoria de Alterações"
                  description="Log completo de alterações no cadastro"
                  checked={permissoesAtuais.auditoriaAlteracoes}
                  onChange={(e) => alternarToggle('auditoriaAlteracoes', e.currentTarget.checked)}
                />
              </Card>
            </SimpleGrid>

            <Group justify="flex-end" mt="lg">
              <Button variant="default" onClick={onFechar}>
                Cancelar
              </Button>
              <Button color="teal" loading={salvando} onClick={aoSalvar}>
                Salvar Permissões de {NOME_CARGO[cargoAtivo]}
              </Button>
            </Group>
          </Stack>
        )}
      </Tabs>
    </Modal>
  )
}
