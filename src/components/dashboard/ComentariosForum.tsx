import { Button, Card, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { useSnapshotInfo } from '../../hooks/useSnapshotInfo'
import { EstadoVazio } from '../EstadoVazio'
import { UserAvatar } from '../UserAvatar'

export interface RespostaForum {
  id: string
  autorNome: string
  /** ID do usuário no Bitrix — resolve a foto real do avatar. Null em dev/mock. */
  autorId: number | null
  criadoEm: string
  texto: string
}

export interface ComentarioForum {
  id: string
  autorNome: string
  autorId: number | null
  criadoEm: string
  texto: string
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

const STORAGE_KEY = 'dashboard_andamento_forum_dias_v1'

function carregarDias(): DiaForum[] {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY)
    return salvo ? JSON.parse(salvo) : []
  } catch {
    return []
  }
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

/**
 * Fórum estilo thread para notas/orientações diárias entre gestores e
 * equipes. Agrupado por "dia" de sincronização (ver `DiaForum`) — sem grupo
 * próprio, comentários de sincronizações diferentes ficariam misturados numa
 * lista só, sem contexto de qual rodada de dados eles comentam.
 *
 * Autor é sempre o usuário logado no Bitrix (`colaborador`), nunca texto
 * livre: é o que permite mostrar a foto real do avatar (via
 * `useFotosColaboradores`) e evita alguém postar em nome de outra pessoa.
 */
export function ComentariosForum({ colaborador }: ComentariosForumProps) {
  const [dias, setDias] = useState<DiaForum[]>(carregarDias)
  const [novoTexto, setNovoTexto] = useState('')
  const [idRespostaAtiva, setIdRespostaAtiva] = useState<string | null>(null)
  const [textoRespostaInput, setTextoRespostaInput] = useState('')
  const fotos = useFotosColaboradores()
  const snapshotInfo = useSnapshotInfo()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dias))
    } catch (e) {
      console.warn('Erro ao salvar comentários do fórum:', e)
    }
  }, [dias])

  // Cada sincronização nova (mudança em snapshotInfo.syncedAt) abre um dia —
  // reage a qualquer snapshot buscado em qualquer parte do app, sem fetch próprio.
  useEffect(() => {
    if (!snapshotInfo) return
    setDias((atual) => {
      if (atual[0]?.syncId === snapshotInfo.syncedAt) return atual
      return [{ syncId: snapshotInfo.syncedAt, comentarios: [] }, ...atual]
    })
  }, [snapshotInfo?.syncedAt])

  /**
   * Dia onde um comentário/resposta novo é arquivado. Normalmente já existe
   * (criado pelo efeito acima); só fica sem existir na janela rara entre o
   * primeiro render e o primeiro snapshot chegar — aqui cria sob demanda para
   * o comentário não se perder.
   */
  function diaAtivoOuCriado(listaAtual: DiaForum[]): [DiaForum, DiaForum[]] {
    const syncId = snapshotInfo?.syncedAt ?? 'sem-sincronizacao'
    if (listaAtual[0]?.syncId === syncId) return [listaAtual[0], listaAtual]
    const novoDia: DiaForum = { syncId, comentarios: [] }
    return [novoDia, [novoDia, ...listaAtual]]
  }

  function aoEnviarComentario() {
    if (!novoTexto.trim() || !colaborador) return

    const novo: ComentarioForum = {
      id: `c_${Date.now()}`,
      autorNome: colaborador.nome,
      autorId: colaborador.id || null,
      criadoEm: new Date().toISOString(),
      texto: novoTexto.trim(),
      respostas: [],
    }

    setDias((atual) => {
      const [dia, lista] = diaAtivoOuCriado(atual)
      return lista.map((d) => (d === dia ? { ...d, comentarios: [novo, ...d.comentarios] } : d))
    })
    setNovoTexto('')
  }

  function aoEnviarResposta(diaSyncId: string, comentarioId: string) {
    if (!textoRespostaInput.trim() || !colaborador) return

    const novaResposta: RespostaForum = {
      id: `r_${Date.now()}`,
      autorNome: colaborador.nome,
      autorId: colaborador.id || null,
      criadoEm: new Date().toISOString(),
      texto: textoRespostaInput.trim(),
    }

    setDias((atual) =>
      atual.map((d) =>
        d.syncId !== diaSyncId
          ? d
          : {
              ...d,
              comentarios: d.comentarios.map((c) =>
                c.id === comentarioId ? { ...c, respostas: [...c.respostas, novaResposta] } : c,
              ),
            },
      ),
    )

    setTextoRespostaInput('')
    setIdRespostaAtiva(null)
  }

  const diasComComentarios = dias.filter((d) => d.comentarios.length > 0)

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
        {diasComComentarios.length === 0 ? (
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
                            </Text>
                          </div>
                        </Group>
                      </Group>

                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {item.texto}
                      </Text>

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
                                    </Text>
                                  </Group>
                                  <Text size="xs" mt={2} style={{ whiteSpace: 'pre-wrap' }}>
                                    {resp.texto}
                                  </Text>
                                </div>
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
                                onClick={() => aoEnviarResposta(dia.syncId, item.id)}
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
