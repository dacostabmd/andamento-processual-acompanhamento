import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Grid,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listarPessoasCadastro,
  reaplicarCadastroCompleto,
  reverterVinculosPessoa,
  salvarVinculosPessoa,
  verificarPermissaoCadastro,
} from '../../services/cadastroPessoasApi'
import { descartarCacheTarefas } from '../../services/dashboardService'
import type { Colaborador, OpcoesCadastro, PessoaCadastro, VinculoEfetivo } from '../../types/domain'
import { EstadoVazio } from '../EstadoVazio'
import { CadastroPessoaEdicao } from './CadastroPessoaEdicao'
import type { AlteracoesCadastro } from './cadastroRascunho'
import classesInput from './FiltrosPainel.module.css'
import classes from './ConfiguracoesCadastroPanel.module.css'

const CLASSES_INPUT = {
  input: classesInput.input,
  label: classesInput.label,
  section: classesInput.secao,
  dropdown: classesInput.dropdown,
  option: classesInput.option,
}

interface ConfiguracoesCadastroPanelProps {
  aberto: boolean
  /** Usuário logado: vai como solicitante em toda escrita (ver cadastroPessoasApi). */
  colaborador: Colaborador | null
  onFechar: () => void
  /** Chamado após uma escrita bem-sucedida, para o dashboard recarregar os números. */
  onCadastroAlterado: () => void
}

interface Filtros {
  nome: string
  departamento: string | null
  supervisor: string | null
  estadoUf: string | null
  somenteEditados: boolean
  /** 'todos' | 'ativos' | 'desligados' — a exclusão lógica é filtro, não remoção. */
  situacao: string
}

const FILTROS_VAZIOS: Filtros = {
  nome: '',
  departamento: null,
  supervisor: null,
  estadoUf: null,
  somenteEditados: false,
  situacao: 'todos',
}

const OPCOES_VAZIAS: OpcoesCadastro = {
  departamentos: [],
  usuarios: [],
  equipes: [],
  departamentosEstado: [],
}

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Valores distintos de um vínculo entre as pessoas carregadas, para os seletores de filtro. */
function valoresDistintos(pessoas: PessoaCadastro[], extrair: (p: PessoaCadastro) => VinculoEfetivo) {
  const valores = new Set<string>()
  pessoas.forEach((p) => {
    const nome = extrair(p).nome
    if (nome) valores.add(nome)
  })
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Tela de configurações: departamento, supervisor, gerente, diretor e Estado/UF
 * de cada pessoa que aparece nas métricas.
 *
 * As três primeiras dimensões — departamento, supervisor e UF — são justamente
 * por onde as métricas de equipe são cortadas, e as duas primeiras vêm do Bitrix
 * com cobertura incompleta (supervisor: 61% das pessoas). Gerente, diretor,
 * departamento de estado e UF de atuação não têm valor legível no portal (ver
 * docs/cadastro-pessoas-e-worker.md §1). Esta tela é a camada de correção; ela
 * grava no worker, não no Bitrix.
 *
 * A ORIGEM de cada valor aparece na tabela de propósito: um supervisor exibido
 * sem ela é indistinguível entre "o Bitrix diz isso" e "alguém digitou isso", e
 * as duas situações pedem ações opostas de quem está conferindo.
 *
 * Pessoas DESLIGADAS aparecem na lista com etiqueta, e a Situação é um filtro —
 * nunca uma remoção. Elas seguem sendo o fechador de cards antigos, e o vínculo
 * delas ainda corta métrica; esconder por padrão faria um número não fechar sem
 * nada na tela explicando quem está de fora.
 */
export function ConfiguracoesCadastroPanel({
  aberto,
  colaborador,
  onFechar,
  onCadastroAlterado,
}: ConfiguracoesCadastroPanelProps) {
  const [pessoas, setPessoas] = useState<PessoaCadastro[]>([])
  const [opcoes, setOpcoes] = useState<OpcoesCadastro>(OPCOES_VAZIAS)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const [emEdicao, setEmEdicao] = useState<PessoaCadastro | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [podeEditar, setPodeEditar] = useState(false)
  const [reaplicando, setReaplicando] = useState(false)
  const [todosOsUsuarios, setTodosOsUsuarios] = useState(false)
  const [totalNoDiretorio, setTotalNoDiretorio] = useState(0)

  const carregar = useCallback(
    async (recarregarDiretorio = false, escopoTodos = todosOsUsuarios) => {
      setCarregando(true)
      try {
        const dados = await listarPessoasCadastro(recarregarDiretorio, escopoTodos)
        setPessoas(dados.pessoas)
        setOpcoes(dados.opcoes)
        setTotalNoDiretorio(dados.totalNoDiretorio)
        setErro(null)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar o cadastro de pessoas.')
      } finally {
        setCarregando(false)
      }
    },
    [todosOsUsuarios],
  )

  useEffect(() => {
    if (!aberto) return
    void carregar()
    // A permissão vem do worker, e não da lista local em utils/pessoas: duas
    // cópias divergiriam, e a divergência apareceria como um 403 no salvamento
    // sem nada na tela que explicasse o motivo.
    void verificarPermissaoCadastro(colaborador).then(setPodeEditar)
  }, [aberto, carregar, colaborador])

  const departamentosFiltro = useMemo(() => valoresDistintos(pessoas, (p) => p.departamento), [pessoas])
  const supervisoresFiltro = useMemo(() => valoresDistintos(pessoas, (p) => p.supervisor), [pessoas])
  const ufsFiltro = useMemo(() => valoresDistintos(pessoas, (p) => p.estadoUf), [pessoas])

  const filtradas = useMemo(() => {
    const alvoNome = normalizar(filtros.nome)
    return pessoas.filter((p) => {
      if (alvoNome && !normalizar(p.nome).includes(alvoNome)) return false
      if (filtros.departamento && p.departamento.nome !== filtros.departamento) return false
      if (filtros.supervisor && p.supervisor.nome !== filtros.supervisor) return false
      if (filtros.estadoUf && p.estadoUf.nome !== filtros.estadoUf) return false
      if (filtros.somenteEditados && p.atualizadoEm === null) return false
      if (filtros.situacao === 'ativos' && p.desligado) return false
      if (filtros.situacao === 'desligados' && !p.desligado) return false
      return true
    })
  }, [pessoas, filtros])

  const desligados = useMemo(() => pessoas.filter((p) => p.desligado).length, [pessoas])

  async function aoSalvar(alteracoes: AlteracoesCadastro) {
    if (!emEdicao) return
    setSalvando(true)
    try {
      let tarefasAtualizadas = 0
      let aviso: string | null = null
      if (Object.keys(alteracoes.definir).length > 0) {
        const r = await salvarVinculosPessoa(
          emEdicao.usuarioId,
          emEdicao.nome,
          alteracoes.definir,
          colaborador,
        )
        tarefasAtualizadas += r.tarefasAtualizadas
        aviso = r.aviso ?? aviso
      }
      if (alteracoes.reverter.length > 0) {
        const r = await reverterVinculosPessoa(emEdicao.usuarioId, alteracoes.reverter, colaborador)
        tarefasAtualizadas += r.tarefasAtualizadas
        aviso = r.aviso ?? aviso
      }

      // Amarelo quando houve aviso: o cadastro foi salvo, mas as tarefas já
      // sincronizadas não foram recalculadas — dizer "tudo certo" em verde
      // esconderia justamente a parte que ficou pendente.
      notifications.show({
        color: aviso ? 'yellow' : 'teal',
        title: aviso ? 'Cadastro salvo, com pendência' : 'Cadastro salvo',
        message:
          aviso ??
          (tarefasAtualizadas > 0
            ? `${tarefasAtualizadas} linha(s) de tarefa recalculada(s) com o novo vínculo.`
            : 'Nenhuma tarefa no recorte atual usa esta pessoa — o vínculo vale a partir do próximo sync.'),
        autoClose: aviso ? 12000 : undefined,
      })

      setEmEdicao(null)
      await carregar()
      // O snapshot em memória do dashboard ficou velho: as colunas de setor,
      // supervisor e equipe das tarefas dessa pessoa acabaram de mudar no banco.
      descartarCacheTarefas()
      onCadastroAlterado()
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar',
        message: e instanceof Error ? e.message : 'Erro inesperado ao salvar o cadastro.',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function aoReaplicar() {
    setReaplicando(true)
    try {
      const r = await reaplicarCadastroCompleto(colaborador)
      notifications.show({
        color: 'teal',
        title: 'Cadastro reaplicado',
        message: `${r.pessoas} pessoa(s) processada(s), ${r.tarefasAtualizadas} linha(s) de tarefa atualizada(s).`,
      })
      descartarCacheTarefas()
      onCadastroAlterado()
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Falha ao reaplicar',
        message: e instanceof Error ? e.message : 'Erro inesperado.',
      })
    } finally {
      setReaplicando(false)
    }
  }

  return (
    <>
      <Modal
        opened={aberto}
        onClose={onFechar}
        fullScreen
        zIndex={300}
        title={
          <Title order={3} className={classes.titulo}>
            Configurações — cadastro de pessoas
          </Title>
        }
        transitionProps={{ transition: 'slide-up', duration: 250 }}
      >
        <div className={classes.conteudo}>
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Departamento, supervisor e Estado/UF são as dimensões pelas quais as métricas de cada
              equipe são cortadas. As duas primeiras vêm do Bitrix24 (o supervisor está preenchido em
              cerca de 61% das pessoas); gerente, diretor, departamento de estado e Estado/UF de
              atuação não têm valor legível no portal e só existem aqui. O que você define nesta tela
              vence o Bitrix nas métricas, e não altera a ficha de ninguém no portal. Clique em
              qualquer linha para editar.
            </Text>

            <Grid align="flex-end">
              <Grid.Col span={{ base: 12, md: 3 }}>
                <TextInput
                  radius="lg"
                  classNames={CLASSES_INPUT}
                  label="Nome"
                  placeholder="Buscar pessoa"
                  value={filtros.nome}
                  onChange={(e) => setFiltros({ ...filtros, nome: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  radius="lg"
                  classNames={CLASSES_INPUT}
                  label="Departamento"
                  placeholder="Todos"
                  data={departamentosFiltro}
                  value={filtros.departamento}
                  onChange={(valor) => setFiltros({ ...filtros, departamento: valor })}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  radius="lg"
                  classNames={CLASSES_INPUT}
                  label="Supervisor"
                  placeholder="Todos"
                  data={supervisoresFiltro}
                  value={filtros.supervisor}
                  onChange={(valor) => setFiltros({ ...filtros, supervisor: valor })}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                <Select
                  radius="lg"
                  classNames={CLASSES_INPUT}
                  label="Estado (UF)"
                  placeholder="Todos"
                  data={ufsFiltro}
                  value={filtros.estadoUf}
                  onChange={(valor) => setFiltros({ ...filtros, estadoUf: valor })}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                <Select
                  radius="lg"
                  classNames={CLASSES_INPUT}
                  label="Situação"
                  data={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'ativos', label: 'Ativos' },
                    { value: 'desligados', label: `Desligados (${desligados})` },
                  ]}
                  value={filtros.situacao}
                  onChange={(valor) => setFiltros({ ...filtros, situacao: valor ?? 'todos' })}
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="lg" wrap="wrap">
                <Checkbox
                  classNames={{ input: classesInput.checkboxInput, label: classesInput.checkboxLabel }}
                  label="Apenas quem tem vínculo editado"
                  checked={filtros.somenteEditados}
                  onChange={(e) => setFiltros({ ...filtros, somenteEditados: e.currentTarget.checked })}
                />
                <Tooltip
                  label="Por padrão a lista traz quem está no Andamento Processual, quem aparece nas tarefas e quem já tem vínculo editado. Marque para carregar o portal inteiro."
                  multiline
                  w={300}
                  withArrow
                >
                  <Checkbox
                    classNames={{ input: classesInput.checkboxInput, label: classesInput.checkboxLabel }}
                    label="Todos os usuários do portal"
                    checked={todosOsUsuarios}
                    disabled={carregando}
                    onChange={(e) => {
                      const marcado = e.currentTarget.checked
                      setTodosOsUsuarios(marcado)
                      void carregar(false, marcado)
                    }}
                  />
                </Tooltip>
                <Text size="sm" c="dimmed">
                  {filtradas.length} de {pessoas.length} pessoa(s)
                  {totalNoDiretorio > pessoas.length && ` · ${totalNoDiretorio} no diretório`}
                </Text>
              </Group>
              <Group gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => setFiltros(FILTROS_VAZIOS)}
                  disabled={carregando}
                >
                  Limpar filtros
                </Button>
                <Tooltip
                  label="Repagina usuários e departamentos no Bitrix (o worker guarda por 1 hora). Use depois de admitir ou mover alguém no portal."
                  multiline
                  w={280}
                  withArrow
                >
                  <Button variant="default" size="xs" onClick={() => void carregar(true)} loading={carregando}>
                    Atualizar do Bitrix
                  </Button>
                </Tooltip>
                {podeEditar && (
                  <Tooltip
                    label="Recalcula setor, supervisor, UF e equipe em todas as tarefas já sincronizadas, sem buscar tarefa nenhuma no Bitrix."
                    multiline
                    w={280}
                    withArrow
                  >
                    <Button variant="default" size="xs" onClick={() => void aoReaplicar()} loading={reaplicando}>
                      Reaplicar em todas as tarefas
                    </Button>
                  </Tooltip>
                )}
              </Group>
            </Group>

            {!podeEditar && !carregando && !erro && (
              <Alert color="yellow" variant="light" title="Somente leitura">
                Seu usuário não está na lista de quem pode editar o cadastro no servidor. Você pode
                conferir os vínculos, mas não alterá-los.
              </Alert>
            )}

            {erro ? (
              <EstadoVazio titulo="Não foi possível carregar o cadastro" descricao={erro} />
            ) : carregando && pessoas.length === 0 ? (
              <Center mih={240}>
                <Loader />
              </Center>
            ) : filtradas.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma pessoa encontrada"
                descricao="Nenhuma pessoa atende aos filtros aplicados. Ajuste a busca ou limpe os filtros."
              />
            ) : (
              <div className={classes.rolagemTabela}>
                <Table highlightOnHover className={classes.tabela} verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Pessoa</Table.Th>
                      <Table.Th>Equipe</Table.Th>
                      <Table.Th>Departamento</Table.Th>
                      <Table.Th>Depto. estado</Table.Th>
                      <Table.Th>Supervisor</Table.Th>
                      <Table.Th>Gerente</Table.Th>
                      <Table.Th>Diretor</Table.Th>
                      <Table.Th>UF</Table.Th>
                      <Table.Th ta="right">Cards</Table.Th>
                      <Table.Th ta="right">Editar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtradas.map((pessoa) => (
                      <Table.Tr
                        key={pessoa.usuarioId}
                        className={classes.linha}
                        // A linha inteira abre a edição — o lápis continua ali como
                        // o controle focável pelo teclado, com rótulo próprio.
                        onClick={() => setEmEdicao(pessoa)}
                      >
                        <Table.Td className={classes.celulaPessoa}>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" fw={500}>
                              {pessoa.nome}
                            </Text>
                            {pessoa.desligado && (
                              <Tooltip
                                label={
                                  pessoa.desligadoEm
                                    ? `Saiu do portal — detectado em ${new Date(pessoa.desligadoEm).toLocaleDateString('pt-BR')}. O cadastro e os cards antigos permanecem.`
                                    : 'Saiu do portal. O cadastro e os cards antigos permanecem.'
                                }
                                multiline
                                w={280}
                                withArrow
                              >
                                <Badge variant="outline" color="gray" size="xs">
                                  Desligado
                                </Badge>
                              </Tooltip>
                            )}
                          </Group>
                          {pessoa.atualizadoPorNome && (
                            <Text size="xs" c="dimmed">
                              editado por {pessoa.atualizadoPorNome}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={pessoa.equipe === 'indefinido' ? 'gray' : 'yellow'}
                            size="sm"
                          >
                            {pessoa.equipe}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <CelulaVinculo vinculo={pessoa.departamento} />
                        </Table.Td>
                        <Table.Td>
                          <CelulaVinculo vinculo={pessoa.departamentoEstado} />
                        </Table.Td>
                        <Table.Td>
                          <CelulaVinculo vinculo={pessoa.supervisor} />
                        </Table.Td>
                        <Table.Td>
                          <CelulaVinculo vinculo={pessoa.gerente} />
                        </Table.Td>
                        <Table.Td>
                          <CelulaVinculo vinculo={pessoa.diretor} />
                        </Table.Td>
                        <Table.Td>
                          <CelulaVinculo vinculo={pessoa.estadoUf} />
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{pessoa.totalCards}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <ActionIcon
                            variant="subtle"
                            color="yellow"
                            aria-label={`Editar vínculos de ${pessoa.nome}`}
                            onClick={() => setEmEdicao(pessoa)}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Stack>
        </div>
      </Modal>

      <CadastroPessoaEdicao
        pessoa={emEdicao}
        opcoes={opcoes}
        podeEditar={podeEditar}
        salvando={salvando}
        onFechar={() => setEmEdicao(null)}
        onSalvar={(alteracoes) => void aoSalvar(alteracoes)}
      />
    </>
  )
}

/**
 * Uma célula de vínculo com a procedência visível. Herdado, editado à mão,
 * desassociado e ausente têm aparências distintas porque pedem ações distintas de
 * quem confere: o primeiro se corrige no portal, o segundo se revisa aqui, o
 * terceiro foi uma decisão consciente e o quarto é falta de dado.
 */
function CelulaVinculo({ vinculo }: { vinculo: VinculoEfetivo }) {
  if (vinculo.origem === 'desassociado') {
    return (
      <Tooltip label="Desassociado à mão — o valor do Bitrix não volta a valer" withArrow>
        <Text size="sm" component="span" className={classes.valorDesassociado}>
          desassociado
        </Text>
      </Tooltip>
    )
  }

  if (!vinculo.nome) {
    return (
      <Text size="sm" component="span" className={classes.valorAusente}>
        —
      </Text>
    )
  }

  if (vinculo.origem === 'cadastro') {
    return (
      <Tooltip label="Definido nesta tela — vence o Bitrix" withArrow>
        <Text size="sm" component="span" className={classes.valorEditado}>
          {vinculo.nome} ✎
        </Text>
      </Tooltip>
    )
  }

  return (
    <Text size="sm" component="span" className={classes.valorHerdado}>
      {vinculo.nome}
    </Text>
  )
}
