import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { ExternalLink, Hourglass, Lock, MessageSquare, Shield, UserCheck, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { listarPessoasCadastro } from '../../services/cadastroPessoasApi'
import { montarCaminhoPerfilBitrix, montarUrlPerfilBitrix } from '../../services/bitrixPortal'
import { abrirNoPortal } from '../../services/bitrixSdk'
import {
  listarEquipes,
  reatribuirEquipeColaborador,
  salvarEstadosAtuacao,
} from '../../services/equipesApi'
import type { Equipe } from '../../types/domain'
import {
  identificarSlotSupervisorPeloNome,
  podeConfigurarPerfilColaborador,
  podeVerComentariosPerfilColaborador,
} from '../../utils/pessoas'
import { tarefaFoiConcluidaComAtraso } from '../../utils/tarefasMetrics'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { COR_POR_EQUIPE, formatarDataHora } from './tarefaApresentacao'

interface AnotacaoGestao {
  id: string
  autor: string
  texto: string
  criadoEm: string
}

interface ColaboradorPerfilAvancadoModalProps {
  colaborador: ColaboradorSelecionado | null
  aberto: boolean
  aoFechar: () => void
  usuarioLogadoNome?: string | null
  usuarioLogadoId?: number | null
}

function formatarTempoExtenso(horas: number): string {
  if (Number.isNaN(horas) || horas <= 0) return '—'
  if (horas < 1) {
    const minutos = Math.round(horas * 60)
    return `${minutos} min`
  }
  if (horas < 24) {
    const h = Math.floor(horas)
    const m = Math.round((horas - h) * 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const dias = (horas / 24).toFixed(1)
  return `${dias} dias`
}

export function ColaboradorPerfilAvancadoModal({
  colaborador,
  aberto,
  aoFechar,
  usuarioLogadoNome,
  usuarioLogadoId,
}: ColaboradorPerfilAvancadoModalProps) {
  const [novaAnotacao, setNovaAnotacao] = useState('')
  const [anotacoes, setAnotacoes] = useState<AnotacaoGestao[]>([])

  const colabId = useMemo(() => {
    if (!colaborador) return null
    const cardComId = colaborador.cards.find(
      (t) => t.fechadoPorId || t.responsavelAtendimentoId || t.responsavelId,
    )
    return (
      cardComId?.fechadoPorId ||
      cardComId?.responsavelAtendimentoId ||
      cardComId?.responsavelId ||
      null
    )
  }, [colaborador])

  const idsParaFoto = useMemo(() => (colabId ? [colabId] : []), [colabId])
  const fotosMap = useFotosColaboradores(idsParaFoto)

  const fotoUrl = colabId ? fotosMap.get(colabId) : null
  const perfilBitrixUrl = colabId ? montarUrlPerfilBitrix(colabId) : null
  const perfilBitrixCaminho = colabId ? montarCaminhoPerfilBitrix(colabId) : null

  const podeConfigurar = podeConfigurarPerfilColaborador(usuarioLogadoNome, usuarioLogadoId)

  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [estadosDisponiveis, setEstadosDisponiveis] = useState<Array<{ id: number; nome: string }>>(
    [],
  )
  const [estadosSelecionados, setEstadosSelecionados] = useState<number[]>([])
  const [salvandoEquipe, setSalvandoEquipe] = useState(false)
  const [salvandoEstados, setSalvandoEstados] = useState(false)

  // Só busca a lista de equipes/departamentos de estado para quem pode
  // configurar o Perfil — os outros veem os campos como texto, sem custo extra.
  useEffect(() => {
    if (!aberto || !podeConfigurar || !colabId) return
    let cancelado = false
    void listarEquipes().then((r) => {
      if (!cancelado) setEquipes(r.equipes)
    })
    void listarPessoasCadastro().then((r) => {
      if (cancelado) return
      setEstadosDisponiveis(r.opcoes.departamentosEstado)
      const pessoa = r.pessoas.find((p) => p.usuarioId === colabId)
      setEstadosSelecionados(pessoa?.departamentoEstado.itens?.map((i) => i.id) ?? [])
    })
    return () => {
      cancelado = true
    }
  }, [aberto, podeConfigurar, colabId])

  const equipeAtual = colabId
    ? equipes.find((e) => e.colaboradores.some((c) => c.id === colabId))
    : undefined

  // O solicitante da escrita é o ADMIN LOGADO (quem está configurando o
  // Perfil), não o colaborador cujo perfil está aberto — é ele que o worker
  // confere em exigirGestaoCadastroOuConfigPerfil.
  const solicitante =
    usuarioLogadoId != null
      ? { id: usuarioLogadoId, nome: usuarioLogadoNome ?? '', ativo: true }
      : null

  async function aoTrocarEquipe(equipeId: string | null) {
    if (!colabId || !colaborador) return
    setSalvandoEquipe(true)
    try {
      await reatribuirEquipeColaborador(
        colabId,
        colaborador.nome,
        equipeId !== null ? Number(equipeId) : null,
        solicitante,
      )
      const r = await listarEquipes()
      setEquipes(r.equipes)
    } finally {
      setSalvandoEquipe(false)
    }
  }

  async function aoTrocarEstados(ids: string[]) {
    if (!colabId || !colaborador) return
    const numeros = ids.map(Number).filter((n) => !Number.isNaN(n))
    setEstadosSelecionados(numeros)
    setSalvandoEstados(true)
    try {
      await salvarEstadosAtuacao(colabId, colaborador.nome, numeros, solicitante)
    } finally {
      setSalvandoEstados(false)
    }
  }

  // Carrega observações salvas do localStorage quando o colaborador muda
  useEffect(() => {
    if (!colaborador) return
    const chaveStorage = `anotacoes_colaborador_${colaborador.nome.trim().toLowerCase()}`
    try {
      const salvas = localStorage.getItem(chaveStorage)
      if (salvas) {
        setAnotacoes(JSON.parse(salvas))
      } else {
        setAnotacoes([])
      }
    } catch {
      setAnotacoes([])
    }
  }, [colaborador])

  const salvarAnotacoes = (novas: AnotacaoGestao[]) => {
    if (!colaborador) return
    const chaveStorage = `anotacoes_colaborador_${colaborador.nome.trim().toLowerCase()}`
    setAnotacoes(novas)
    try {
      localStorage.setItem(chaveStorage, JSON.stringify(novas))
    } catch (err) {
      console.warn('Não foi possível salvar anotações no localStorage:', err)
    }
  }

  const handleAdicionarAnotacao = () => {
    if (!novaAnotacao.trim() || !colaborador) return
    const nova: AnotacaoGestao = {
      id: String(Date.now()),
      autor: usuarioLogadoNome || 'Gestor',
      texto: novaAnotacao.trim(),
      criadoEm: new Date().toISOString(),
    }
    const atualizadas = [nova, ...anotacoes]
    salvarAnotacoes(atualizadas)
    setNovaAnotacao('')
  }

  const handleExcluirAnotacao = (id: string) => {
    const atualizadas = anotacoes.filter((a) => a.id !== id)
    salvarAnotacoes(atualizadas)
  }

  // Métricas calculadas sobre o conjunto de tarefas do colaborador
  const metricasCalculadas = useMemo(() => {
    if (!colaborador || colaborador.cards.length === 0) {
      return {
        departamentos: [],
        supervisor: 'Não informado',
        ultimaAtividade: null,
        tempoMedioHoras: 0,
        pctConcluidasAtrasadas: 0,
        pctConcluidasSemComentario: 0,
        totalConcluidas: 0,
        totalAtrasadas: 0,
        totalSemComentario: 0,
      }
    }

    const cards = colaborador.cards

    // 1. Departamentos
    const deptoSet = new Set<string>()
    cards.forEach((t) => {
      if (t.fechadoPorDepartamentos && t.fechadoPorDepartamentos.length > 0) {
        t.fechadoPorDepartamentos.forEach((d) => deptoSet.add(d))
      }
      if (t.setorFechador) deptoSet.add(t.setorFechador)
      if (t.setorAtendimento) deptoSet.add(t.setorAtendimento)
    })
    const departamentos = Array.from(deptoSet).filter(Boolean)

    // 2. Supervisor
    const slot = identificarSlotSupervisorPeloNome(colaborador.equipe)
    const supervisor = slot ? slot.rotulo : colaborador.equipe || 'Não atribuído'

    // 3. Última atividade
    let maxTimestamp = 0
    cards.forEach((t) => {
      if (t.finalizadoEm) {
        const ts = new Date(t.finalizadoEm).getTime()
        if (ts > maxTimestamp) maxTimestamp = ts
      }
      if (t.criadoEm) {
        const ts = new Date(t.criadoEm).getTime()
        if (ts > maxTimestamp) maxTimestamp = ts
      }
      if (t.prazoFinal) {
        const ts = new Date(t.prazoFinal).getTime()
        if (ts > maxTimestamp) maxTimestamp = ts
      }
    })
    const ultimaAtividade = maxTimestamp > 0 ? new Date(maxTimestamp).toISOString() : null

    // 4. Concluídas & Tempo Médio
    const concluidas = cards.filter((t) => t.status === 5)
    const totalConcluidas = concluidas.length

    let somaHoras = 0
    let countComDatas = 0
    let countAtrasadas = 0
    let countSemComentario = 0

    concluidas.forEach((t) => {
      if (tarefaFoiConcluidaComAtraso(t)) {
        countAtrasadas++
      }
      if (!t.comentariosCount || t.comentariosCount === 0) {
        countSemComentario++
      }
      if (t.criadoEm && t.finalizadoEm) {
        const inicio = new Date(t.criadoEm).getTime()
        const fim = new Date(t.finalizadoEm).getTime()
        if (fim >= inicio) {
          somaHoras += (fim - inicio) / (1000 * 60 * 60)
          countComDatas++
        }
      }
    })

    const tempoMedioHoras = countComDatas > 0 ? somaHoras / countComDatas : 0
    const pctConcluidasAtrasadas =
      totalConcluidas > 0 ? (countAtrasadas / totalConcluidas) * 100 : 0
    const pctConcluidasSemComentario =
      totalConcluidas > 0 ? (countSemComentario / totalConcluidas) * 100 : 0

    return {
      departamentos,
      supervisor,
      ultimaAtividade,
      tempoMedioHoras,
      pctConcluidasAtrasadas,
      pctConcluidasSemComentario,
      totalConcluidas,
      totalAtrasadas: countAtrasadas,
      totalSemComentario: countSemComentario,
    }
  }, [colaborador])

  if (!colaborador) return null

  const podeVerComentarios = podeVerComentariosPerfilColaborador(usuarioLogadoNome, usuarioLogadoId)

  const corEquipe =
    colaborador.equipe && colaborador.equipe !== 'indefinido'
      ? COR_POR_EQUIPE[colaborador.equipe]
      : undefined

  return (
    <Modal
      opened={aberto}
      onClose={aoFechar}
      zIndex={1200}
      title={
        <Group gap="xs">
          <UserCheck size={20} style={{ color: 'var(--mantine-color-yellow-4)' }} />
          <Text fw={700} size="md">
            Perfil de Colaborador
          </Text>
        </Group>
      }
      centered
      size="auto"
      styles={{ content: { width: 'min(820px, calc(100vw - 2rem))' } }}
      radius="md"
      transitionProps={{ transition: 'slide-up', duration: 250 }}
    >
      <Stack gap="lg">
        {/* Cabeçalho do Colaborador */}
        <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <UserAvatar nome={colaborador.nome} fotoUrl={fotoUrl} size={54} />
              <div>
                <Group gap="xs">
                  <Text fw={700} size="xl">
                    {colaborador.nome}
                  </Text>
                  {colaborador.equipe && (
                    <Badge
                      size="sm"
                      variant="light"
                      color={corEquipe ? undefined : 'gray'}
                      style={
                        corEquipe
                          ? { backgroundColor: `${corEquipe}22`, color: corEquipe }
                          : undefined
                      }
                    >
                      {colaborador.equipe}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {colaborador.papel} · {colaborador.cards.length} tarefa(s) atribuídas
                </Text>
              </div>
            </Group>

            {perfilBitrixUrl && perfilBitrixCaminho && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<ExternalLink size={14} />}
                onClick={() => abrirNoPortal(perfilBitrixCaminho, perfilBitrixUrl)}
              >
                Perfil no Bitrix24
              </Button>
            )}
          </Group>
        </Paper>

        {/* Métricas Principais em Grade de Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {/* Card 1: Departamento & Supervisor */}
          <Card
            padding="md"
            radius="md"
            withBorder
            style={{ backgroundColor: 'var(--superficie)' }}
          >
            <Stack gap="xs">
              <Group gap="xs" align="center">
                <Shield size={18} style={{ color: 'var(--mantine-color-blue-4)' }} />
                <Text fw={700} size="xs" c="dimmed" tt="uppercase">
                  Organização
                </Text>
              </Group>
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Supervisor responsável:
                </Text>
                {podeConfigurar ? (
                  <Select
                    size="xs"
                    radius="lg"
                    placeholder="Sem equipe"
                    data={equipes.map((e) => ({ value: String(e.id), label: e.nome }))}
                    value={equipeAtual ? String(equipeAtual.id) : null}
                    disabled={salvandoEquipe}
                    clearable
                    searchable
                    comboboxProps={{ zIndex: 1300, withinPortal: true }}
                    onChange={(valor) => void aoTrocarEquipe(valor)}
                  />
                ) : (
                  <Text fw={600} size="sm">
                    {metricasCalculadas.supervisor}
                  </Text>
                )}
              </div>
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Departamento(s):
                </Text>
                {metricasCalculadas.departamentos.length > 0 ? (
                  <Group gap={4} wrap="wrap">
                    {metricasCalculadas.departamentos.map((dep) => (
                      <Badge key={dep} size="xs" variant="outline" color="blue">
                        {dep}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">
                    Não informado
                  </Text>
                )}
              </div>
            </Stack>
          </Card>

          {/* Card 2: Última Atividade & Velocidade */}
          <Card
            padding="md"
            radius="md"
            withBorder
            style={{ backgroundColor: 'var(--superficie)' }}
          >
            <Stack gap="xs">
              <Group gap="xs" align="center">
                <Zap size={18} style={{ color: 'var(--mantine-color-yellow-4)' }} />
                <Text fw={700} size="xs" c="dimmed" tt="uppercase">
                  Atividade & Rapidez
                </Text>
              </Group>
              <div>
                <Text size="xs" c="dimmed">
                  Última atividade em tarefa:
                </Text>
                <Text fw={600} size="sm">
                  {metricasCalculadas.ultimaAtividade
                    ? formatarDataHora(metricasCalculadas.ultimaAtividade)
                    : 'Sem registro recente'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Tempo médio de execução:
                </Text>
                <Badge variant="light" color="yellow" size="sm" mt={2}>
                  {formatarTempoExtenso(metricasCalculadas.tempoMedioHoras)}
                </Badge>
              </div>
            </Stack>
          </Card>

          {/* Card 3: Qualidade & Pontualidade */}
          <Card
            padding="md"
            radius="md"
            withBorder
            style={{ backgroundColor: 'var(--superficie)' }}
          >
            <Stack gap="xs">
              <Group gap="xs" align="center">
                <Hourglass size={18} style={{ color: 'var(--mantine-color-orange-4)' }} />
                <Text fw={700} size="xs" c="dimmed" tt="uppercase">
                  Entregas & Qualidade
                </Text>
              </Group>
              <div>
                <Text size="xs" c="dimmed">
                  Concluídas com atraso:
                </Text>
                <Group gap="xs" align="center">
                  <Text fw={700} size="sm" c="orange">
                    {metricasCalculadas.pctConcluidasAtrasadas.toFixed(1)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({metricasCalculadas.totalAtrasadas} de {metricasCalculadas.totalConcluidas})
                  </Text>
                </Group>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Sem comentários/atividades:
                </Text>
                <Group gap="xs" align="center">
                  <Text fw={700} size="sm" c="red">
                    {metricasCalculadas.pctConcluidasSemComentario.toFixed(1)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({metricasCalculadas.totalSemComentario} de {metricasCalculadas.totalConcluidas}
                    )
                  </Text>
                </Group>
              </div>
            </Stack>
          </Card>
        </SimpleGrid>

        {podeConfigurar && (
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
            <Text size="xs" c="dimmed" mb={6}>
              Departamentos de estado (Andamento):
            </Text>
            <MultiSelect
              size="xs"
              radius="lg"
              placeholder="Selecione os estados de atuação"
              data={estadosDisponiveis.map((d) => ({ value: String(d.id), label: d.nome }))}
              value={estadosSelecionados.map(String)}
              disabled={salvandoEstados}
              searchable
              clearable
              comboboxProps={{ zIndex: 1300, withinPortal: true }}
              onChange={(ids) => void aoTrocarEstados(ids)}
            />
          </Paper>
        )}

        <Divider />

        {/* Seção de Observações de Gestão & Comentários */}
        <div>
          <Group justify="space-between" align="center" mb="xs">
            <Group gap="xs">
              <MessageSquare size={18} style={{ color: 'var(--mantine-color-teal-4)' }} />
              <Text fw={700} size="md">
                Anotações de Gestão & Observações do Colaborador
              </Text>
            </Group>
            {podeVerComentarios && (
              <Badge variant="light" color="teal" size="xs">
                Acesso Autorizado
              </Badge>
            )}
          </Group>

          {podeVerComentarios ? (
            <Stack gap="md">
              <Paper p="sm" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
                <Stack gap="xs">
                  <Textarea
                    placeholder="Adicionar nova observação ou nota de acompanhamento do colaborador…"
                    value={novaAnotacao}
                    onChange={(e) => setNovaAnotacao(e.currentTarget.value)}
                    minRows={2}
                    size="xs"
                  />
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      color="teal"
                      disabled={!novaAnotacao.trim()}
                      onClick={handleAdicionarAnotacao}
                    >
                      Salvar Observação
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              {anotacoes.length === 0 ? (
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                  Nenhuma anotação registrada para este colaborador ainda.
                </Text>
              ) : (
                <Stack gap="xs">
                  {anotacoes.map((a) => (
                    <Paper
                      key={a.id}
                      p="xs"
                      radius="md"
                      withBorder
                      style={{ backgroundColor: 'var(--superficie-borda)' }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Group gap="xs" mb={2}>
                            <Text fw={700} size="xs">
                              {a.autor}
                            </Text>
                            <Text size="xs" c="dimmed">
                              · {formatarDataHora(a.criadoEm)}
                            </Text>
                          </Group>
                          <Text size="sm">{a.texto}</Text>
                        </div>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleExcluirAnotacao(a.id)}
                        >
                          Excluir
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          ) : (
            <Alert
              icon={<Lock size={16} />}
              title="Acesso Restrito aos Comentários de Gestão"
              color="orange"
              variant="light"
            >
              Apenas Supervisores, Líderes de equipe e administradores autorizados (Caio Marques,
              Handerson Salles, Helen Gomes, Bruno Durão) possuem acesso às observações registradas
              para este colaborador.
            </Alert>
          )}
        </div>
      </Stack>
    </Modal>
  )
}
