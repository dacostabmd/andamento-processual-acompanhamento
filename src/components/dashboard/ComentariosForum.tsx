import { ActionIcon, Button, Card, Group, Paper, Stack, Text, Textarea, Title, Tooltip } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { useSnapshotInfo } from '../../hooks/useSnapshotInfo'
import {
  buscarComentariosDoDia,
  criarComentarioApi,
  editarComentarioApi,
  excluirComentarioApi,
  type ComentarioForumApi,
  type SolicitanteAcao,
} from '../../services/comentariosApi'
import { ehCaioMarques, equipeSupervisionadaPeloNome } from '../../utils/pessoas'
import { EstadoVazio } from '../EstadoVazio'
import { UserAvatar } from '../UserAvatar'

/** Uma resposta dentro da thread de um comentário — mesmo shape do comentário raiz. */
export type RespostaForum = ComentarioForumApi

export interface ComentarioForum extends ComentarioForumApi {
  respostas: RespostaForum[]
}

/**
 * Um "dia" do fórum: os comentários registrados entre uma rodada de sync do
 * worker e a próxima. `syncId` é o `syncedAt` do snapshot vigente quando o
 * dia foi aberto — cada sincronização abre um dia novo, MESMO que já exista
 * um para a mesma data de calendário (o corte é por rodada de sync, não por
 * dia civil: duas sincronizações no mesmo dia abrem dois dias de fórum).
 */
export interface DiaForum {
  syncId: string
  comentarios: ComentarioForum[]
}

interface ComentariosForumProps {
  /** Usuário logado no Bitrix — autor de qualquer comentário/resposta nova. Null enquanto a sessão carrega. */
  colaborador: { id: number; nome: string } | null
}

function formatarRotuloDia(syncId: string): string {
  const d = new Date(syncId)
  if (Number.isNaN(d.getTime())) return 'Antes da primeira sincronização'
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `Sincronização de ${data} às ${hora}`
}

function formatarHora(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'agora'
  }
}

/** Agrupa a lista plana da API (comentários + respostas misturados) em raízes com suas respostas aninhadas. */
function agruparEmArvore(itens: ComentarioForumApi[]): ComentarioForum[] {
  const raizes = itens
    .filter((i) => !i.comentarioPaiId)
    .map((raiz) => ({
      ...raiz,
      respostas: itens
        .filter((i) => i.comentarioPaiId === raiz.id)
        .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    }))
  return raizes.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

/**
 * Fórum estilo thread para notas/orientações diárias entre gestores e
 * equipes. Agrupado por "dia" de sincronização (ver `DiaForum`) — sem grupo
 * próprio, comentários de sincronizações diferentes ficariam misturados numa
 * lista só, sem contexto de qual rodada de dados eles comentam.
 *
 * Autor é sempre o usuário logado no Bitrix (`colaborador`), nunca texto
 * livre: é o que permite mostrar a foto real do avatar (via
 * `useFotosColaboradores`) e evita alguém postar em nome de outra pessoa.
 *
 * Persistido no worker (PostgreSQL), não mais em localStorage: cada
 * criação/edição/exclusão é logada em `comentarios_forum_log` para auditoria
 * (ver server.ts/db.ts) — comentários precisam sobreviver a troca de
 * navegador/dispositivo e a moderação precisa ser rastreável.
 */
export function ComentariosForum({ colaborador }: ComentariosForumProps) {
  const [comentarios, setComentarios] = useState<ComentarioForum[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [novoTexto, setNovoTexto] = useState('')
  const [idRespostaAtiva, setIdRespostaAtiva] = useState<string | null>(null)
  const [textoRespostaInput, setTextoRespostaInput] = useState('')
  const [idEdicaoAtiva, setIdEdicaoAtiva] = useState<string | null>(null)
  const [textoEdicaoInput, setTextoEdicaoInput] = useState('')
  const snapshotInfo = useSnapshotInfo()

  // Autores dos comentários/respostas já carregados, mais o próprio usuário
  // logado (que aparece no formulário de novo comentário antes de publicar
  // nada) — não precisa de mais ninguém do portal.
  const idsColaboradores = useMemo(() => {
    const ids = new Set<number>()
    comentarios.forEach((c) => {
      if (c.autorId) ids.add(c.autorId)
      c.respostas.forEach((r) => {
        if (r.autorId) ids.add(r.autorId)
      })
    })
    if (colaborador?.id) ids.add(colaborador.id)
    return Array.from(ids)
  }, [comentarios, colaborador])
  const fotos = useFotosColaboradores(idsColaboradores)

  const diaSyncId = snapshotInfo?.syncedAt ?? 'sem-sincronizacao'

  // Reconhece o usuário logado como moderador: qualquer uma das 4
  // supervisoras (por nome, ver equipeSupervisionadaPeloNome) ou o admin
  // (Caio Marques) pode editar/excluir comentário de qualquer pessoa —
  // decisão do usuário: moderação não é restrita à própria equipe.
  const souModerador = useMemo(
    () => equipeSupervisionadaPeloNome(colaborador?.nome) !== null || ehCaioMarques(colaborador?.nome),
    [colaborador],
  )

  const solicitante: SolicitanteAcao | null = colaborador
    ? {
        solicitanteId: colaborador.id || null,
        solicitanteNome: colaborador.nome,
        ehModerador: souModerador,
      }
    : null

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    setErro(null)
    buscarComentariosDoDia(diaSyncId)
      .then((itens) => {
        if (!cancelado) setComentarios(agruparEmArvore(itens))
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar os comentários deste dia.')
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [diaSyncId])

  function podeModerar(item: ComentarioForumApi): boolean {
    if (!colaborador) return false
    if (souModerador) return true
    if (item.autorId != null) return item.autorId === colaborador.id
    return item.autorNome.trim().toLowerCase() === colaborador.nome.trim().toLowerCase()
  }

  async function aoEnviarComentario() {
    if (!novoTexto.trim() || !colaborador) return
    try {
      await criarComentarioApi({
        diaSyncId,
        autorId: colaborador.id || null,
        autorNome: colaborador.nome,
        texto: novoTexto.trim(),
      })
      setNovoTexto('')
      const itens = await buscarComentariosDoDia(diaSyncId)
      setComentarios(agruparEmArvore(itens))
    } catch {
      setErro('Não foi possível publicar o comentário. Tente novamente.')
    }
  }

  async function aoEnviarResposta(comentarioId: string) {
    if (!textoRespostaInput.trim() || !colaborador) return
    try {
      await criarComentarioApi({
        diaSyncId,
        comentarioPaiId: comentarioId,
        autorId: colaborador.id || null,
        autorNome: colaborador.nome,
        texto: textoRespostaInput.trim(),
      })
      setTextoRespostaInput('')
      setIdRespostaAtiva(null)
      const itens = await buscarComentariosDoDia(diaSyncId)
      setComentarios(agruparEmArvore(itens))
    } catch {
      setErro('Não foi possível publicar a resposta. Tente novamente.')
    }
  }

  async function aoConfirmarEdicao(id: string) {
    if (!textoEdicaoInput.trim() || !solicitante) return
    try {
      await editarComentarioApi(id, textoEdicaoInput.trim(), solicitante)
      setIdEdicaoAtiva(null)
      setTextoEdicaoInput('')
      const itens = await buscarComentariosDoDia(diaSyncId)
      setComentarios(agruparEmArvore(itens))
    } catch {
      setErro('Não foi possível salvar a edição. Tente novamente.')
    }
  }

  async function aoExcluir(id: string) {
    if (!solicitante) return
    try {
      await excluirComentarioApi(id, solicitante)
      const itens = await buscarComentariosDoDia(diaSyncId)
      setComentarios(agruparEmArvore(itens))
    } catch {
      setErro('Não foi possível excluir. Tente novamente.')
    }
  }

  function iniciarEdicao(item: ComentarioForumApi) {
    setIdEdicaoAtiva(item.id)
    setTextoEdicaoInput(item.texto)
  }

  function renderAcoesModeracao(item: ComentarioForumApi) {
    if (!podeModerar(item)) return null
    return (
      <Group gap={4}>
        <Tooltip label="Editar">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => iniciarEdicao(item)}>
            ✏️
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Excluir">
          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => aoExcluir(item.id)}>
            🗑️
          </ActionIcon>
        </Tooltip>
      </Group>
    )
  }

  function renderFormularioEdicao(id: string) {
    return (
      <Stack gap="xs" mt={4}>
        <Textarea
          value={textoEdicaoInput}
          onChange={(e) => setTextoEdicaoInput(e.currentTarget.value)}
          minRows={2}
          autosize
          size="xs"
        />
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="default" onClick={() => setIdEdicaoAtiva(null)}>
            Cancelar
          </Button>
          <Button size="xs" color="blue" onClick={() => aoConfirmarEdicao(id)} disabled={!textoEdicaoInput.trim()}>
            Salvar
          </Button>
        </Group>
      </Stack>
    )
  }

  const diasComComentarios = diaSyncId
    ? [{ syncId: diaSyncId, comentarios }].filter((d) => d.comentarios.length > 0)
    : []

  return (
    <Card padding="lg" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }} mt="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>Fórum de Acompanhamento Diário</Title>
            <Text size="xs" c="dimmed">
              Espaço de discussão estilo fórum para registrar notas, orientações e observações diárias entre os gestores e equipes.
            </Text>
          </div>
        </Group>

        {erro && (
          <Text size="xs" c="red">
            {erro}
          </Text>
        )}

        {/* Formulário de Novo Comentário */}
        <Paper p="sm" radius="md" withBorder style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Stack gap="xs">
            <Group gap="xs">
              <UserAvatar
                nome={colaborador?.nome ?? '?'}
                fotoUrl={colaborador ? fotos.get(colaborador.id) : undefined}
                size={28}
              />
              <Text size="sm" fw={600}>
                {colaborador?.nome ?? 'Identificando usuário…'}
              </Text>
            </Group>
            <Textarea
              placeholder="Escreva um comentário ou orientação sobre o desempenho do dia..."
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.currentTarget.value)}
              minRows={2}
              autosize
            />
            <Group justify="flex-end">
              <Button
                size="xs"
                color="blue"
                onClick={aoEnviarComentario}
                disabled={!novoTexto.trim() || !colaborador}
              >
                Publicar Comentário
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Lista de Dias de sincronização / Comentários / Threads */}
        {carregando ? (
          <Text size="xs" c="dimmed">
            Carregando comentários…
          </Text>
        ) : diasComComentarios.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum comentário ainda"
            descricao="Seja o primeiro a registrar uma nota ou orientação sobre o dia."
          />
        ) : (
          <Stack gap="lg" mt="sm">
            {diasComComentarios.map((dia) => (
              <Stack key={dia.syncId} gap="sm">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {formatarRotuloDia(dia.syncId)}
                </Text>

                {dia.comentarios.map((item) => (
                  <Paper key={item.id} p="md" radius="md" withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Group gap="xs">
                          <UserAvatar
                            nome={item.autorNome}
                            fotoUrl={item.autorId ? fotos.get(item.autorId) : undefined}
                            size={32}
                          />
                          <div>
                            <Text size="sm" fw={700}>
                              {item.autorNome}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatarHora(item.criadoEm)}
                              {item.editadoEm ? ' (editado)' : ''}
                            </Text>
                          </div>
                        </Group>
                        {renderAcoesModeracao(item)}
                      </Group>

                      {idEdicaoAtiva === item.id ? (
                        renderFormularioEdicao(item.id)
                      ) : (
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                          {item.texto}
                        </Text>
                      )}

                      <Group justify="flex-start" mt={4}>
                        <Button
                          variant="subtle"
                          size="xs"
                          color="gray"
                          onClick={() =>
                            setIdRespostaAtiva(idRespostaAtiva === item.id ? null : item.id)
                          }
                        >
                          💬 Responder ({item.respostas.length})
                        </Button>
                      </Group>

                      {/* Sub-threads / Respostas */}
                      {item.respostas.length > 0 && (
                        <Stack
                          gap="xs"
                          ml="lg"
                          mt="xs"
                          style={{ borderLeft: '2px solid var(--superficie-borda)', paddingLeft: 12 }}
                        >
                          {item.respostas.map((resp) => (
                            <Paper
                              key={resp.id}
                              p="xs"
                              radius="sm"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                            >
                              <Group gap="xs" align="flex-start" justify="space-between">
                                <Group gap="xs" align="flex-start">
                                  <UserAvatar
                                    nome={resp.autorNome}
                                    fotoUrl={resp.autorId ? fotos.get(resp.autorId) : undefined}
                                    size={24}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <Group justify="space-between" align="center">
                                      <Text size="xs" fw={700}>
                                        {resp.autorNome}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {formatarHora(resp.criadoEm)}
                                        {resp.editadoEm ? ' (editado)' : ''}
                                      </Text>
                                    </Group>
                                    {idEdicaoAtiva === resp.id ? (
                                      renderFormularioEdicao(resp.id)
                                    ) : (
                                      <Text size="xs" mt={2} style={{ whiteSpace: 'pre-wrap' }}>
                                        {resp.texto}
                                      </Text>
                                    )}
                                  </div>
                                </Group>
                                {renderAcoesModeracao(resp)}
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      )}

                      {/* Formulário de Resposta no Thread */}
                      {idRespostaAtiva === item.id && (
                        <Paper p="xs" radius="sm" ml="lg" mt="xs" withBorder>
                          <Stack gap="xs">
                            <Textarea
                              placeholder={`Responder para ${item.autorNome}...`}
                              value={textoRespostaInput}
                              onChange={(e) => setTextoRespostaInput(e.currentTarget.value)}
                              minRows={2}
                              autosize
                              size="xs"
                            />
                            <Group justify="flex-end">
                              <Button size="xs" variant="default" onClick={() => setIdRespostaAtiva(null)}>
                                Cancelar
                              </Button>
                              <Button
                                size="xs"
                                color="blue"
                                onClick={() => aoEnviarResposta(item.id)}
                                disabled={!textoRespostaInput.trim() || !colaborador}
                              >
                                Enviar Resposta
                              </Button>
                            </Group>
                          </Stack>
                        </Paper>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
