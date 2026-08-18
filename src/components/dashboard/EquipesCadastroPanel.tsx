import {
  Alert,
  Avatar,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  reaplicarCadastroCompleto,
  verificarPermissaoCadastro,
} from '../../services/cadastroPessoasApi'
import { descartarCacheTarefas } from '../../services/dashboardService'
import { excluirEquipe, listarEquipes, salvarEquipe } from '../../services/equipesApi'
import type { Colaborador, Equipe, OpcoesEquipe } from '../../types/domain'
import { EstadoVazio } from '../EstadoVazio'
import { EquipeEdicaoModal, type EquipeEmEdicao } from './EquipeEdicaoModal'
import classes from './EquipesCadastroPanel.module.css'

interface EquipesCadastroPanelProps {
  aberto: boolean
  /** Usuário logado: vai como solicitante em toda escrita. */
  colaborador: Colaborador | null
  onFechar: () => void
  /** Chamado após uma escrita bem-sucedida, para o dashboard recarregar os números. */
  onCadastroAlterado: () => void
}

const OPCOES_VAZIAS: OpcoesEquipe = { departamentos: [], usuarios: [], departamentosEstado: [] }

export function EquipesCadastroPanel({
  aberto,
  colaborador,
  onFechar,
  onCadastroAlterado,
}: EquipesCadastroPanelProps) {
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [opcoes, setOpcoes] = useState<OpcoesEquipe>(OPCOES_VAZIAS)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [podeEditar, setPodeEditar] = useState(false)
  const [emEdicao, setEmEdicao] = useState<EquipeEmEdicao>(null)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [reaplicando, setReaplicando] = useState(false)

  const carregar = useCallback(async (recarregarDiretorio = false) => {
    setCarregando(true)
    try {
      const dados = await listarEquipes(recarregarDiretorio)
      setEquipes(dados.equipes)
      setOpcoes(dados.opcoes)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as equipes.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!aberto) return
    void carregar()
    void verificarPermissaoCadastro(colaborador).then((p) => setPodeEditar(p.podeEditar))
  }, [aberto, carregar, colaborador])

  async function aoSalvar(input: Parameters<typeof salvarEquipe>[0]) {
    setSalvando(true)
    try {
      const { pessoasMovidas } = await salvarEquipe(input, colaborador)
      notifications.show({
        color: 'teal',
        title: 'Equipe salva',
        message:
          pessoasMovidas.length > 0
            ? `${pessoasMovidas.join(', ')} também estava(m) em outra equipe e foi(ram) movida(s) para esta.`
            : 'Departamento, supervisor e colaboradores atualizados.',
        autoClose: pessoasMovidas.length > 0 ? 10000 : undefined,
      })
      setEmEdicao(null)
      await carregar()
      descartarCacheTarefas()
      onCadastroAlterado()
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar a equipe',
        message: e instanceof Error ? e.message : 'Erro inesperado ao salvar a equipe.',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function aoExcluir(id: number) {
    setExcluindo(true)
    try {
      await excluirEquipe(id, colaborador)
      notifications.show({
        color: 'teal',
        title: 'Equipe excluída',
        message: 'Os colaboradores voltaram a herdar departamento e supervisor do Bitrix.',
      })
      setEmEdicao(null)
      await carregar()
      descartarCacheTarefas()
      onCadastroAlterado()
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível excluir a equipe',
        message: e instanceof Error ? e.message : 'Erro inesperado ao excluir a equipe.',
      })
    } finally {
      setExcluindo(false)
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
            Configurações — equipes
          </Title>
        }
        transitionProps={{ transition: 'slide-up', duration: 250 }}
      >
        <div className={classes.conteudo}>
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Text size="sm" c="dimmed" maw={640}>
                Cada equipe é departamento + supervisor + colaboradores. Salvar uma equipe define o
                departamento e o supervisor de cada colaborador listado nela — o que vence o Bitrix
                nas métricas, sem alterar a ficha de ninguém no portal. Clique num cartão para
                editar.
              </Text>
              <Tooltip
                label="Recalcula setor, supervisor, UF e equipe em todas as tarefas já sincronizadas, sem buscar tarefa nenhuma no Bitrix."
                multiline
                w={280}
                withArrow
              >
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => void aoReaplicar()}
                  loading={reaplicando}
                >
                  Reaplicar em todas as tarefas
                </Button>
              </Tooltip>
            </Group>

            {!podeEditar && !carregando && !erro && (
              <Alert color="yellow" variant="light" title="Somente leitura">
                Seu usuário não está na lista de quem pode editar equipes no servidor. Você pode
                conferir a composição de cada uma, mas não alterá-la.
              </Alert>
            )}

            {erro ? (
              <EstadoVazio titulo="Não foi possível carregar as equipes" descricao={erro} />
            ) : carregando && equipes.length === 0 ? (
              <Center mih={240}>
                <Loader />
              </Center>
            ) : (
              <div className={classes.grade}>
                <AnimatePresence mode="popLayout">
                  {equipes.map((equipe, indice) => (
                    <motion.div
                      key={equipe.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.22, delay: indice * 0.04 }}
                    >
                      <CardEquipe equipe={equipe} onClick={() => setEmEdicao(equipe)} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {podeEditar && (
                  <button
                    type="button"
                    className={classes.cardNovo}
                    onClick={() => setEmEdicao('nova')}
                    aria-label="Criar nova equipe"
                  >
                    <Group gap={6}>
                      <Plus size={16} />
                      <Text size="sm" fw={600}>
                        Nova equipe
                      </Text>
                    </Group>
                  </button>
                )}
              </div>
            )}
          </Stack>
        </div>
      </Modal>

      <EquipeEdicaoModal
        alvo={emEdicao}
        opcoes={opcoes}
        podeEditar={podeEditar}
        salvando={salvando}
        excluindo={excluindo}
        onFechar={() => setEmEdicao(null)}
        onSalvar={(input) => void aoSalvar(input)}
        onExcluir={(id) => void aoExcluir(id)}
      />
    </>
  )
}

function CardEquipe({ equipe, onClick }: { equipe: Equipe; onClick: () => void }) {
  const extras = equipe.colaboradores.length - 4

  return (
    <div className={classes.card} onClick={onClick} role="button" tabIndex={0}>
      <Stack gap="xs" p="md">
        <Text fw={700} size="md">
          {equipe.nome}
        </Text>
        <Group gap={4} wrap="wrap">
          <Badge size="xs" variant="outline" color="blue">
            {equipe.departamentoNome ?? 'Sem departamento'}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Supervisor: {equipe.supervisorNome ?? '—'}
        </Text>
        <Group gap={4} align="center">
          <Avatar.Group>
            {equipe.colaboradores.slice(0, 4).map((c) => (
              <Avatar key={c.id} size="sm" radius="xl" name={c.nome} color="initials" />
            ))}
          </Avatar.Group>
          <Text size="xs" c="dimmed">
            {equipe.colaboradores.length === 0
              ? 'Sem colaboradores'
              : `${equipe.colaboradores.length} colaborador(es)${extras > 0 ? ` (+${extras})` : ''}`}
          </Text>
        </Group>
      </Stack>
    </div>
  )
}
