import {
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { EstadoVazio } from '../EstadoVazio'
import { UserAvatar } from '../UserAvatar'

export interface RespostaForum {
  id: string
  autorNome: string
  criadoEm: string
  texto: string
}

export interface ComentarioForum {
  id: string
  dataIso: string
  autorNome: string
  criadoEm: string
  texto: string
  respostas: RespostaForum[]
}

const STORAGE_KEY = 'dashboard_andamento_forum_comentarios_v1'

export function ComentariosForum() {
  const [comentarios, setComentarios] = useState<ComentarioForum[]>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY)
      return salvo ? JSON.parse(salvo) : []
    } catch {
      return []
    }
  })

  const [novoTexto, setNovoTexto] = useState('')
  const [autorNomeInput, setAutorNomeInput] = useState('Caio Marques')
  const [idRespostaAtiva, setIdRespostaAtiva] = useState<string | null>(null)
  const [textoRespostaInput, setTextoRespostaInput] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comentarios))
    } catch (e) {
      console.warn('Erro ao salvar comentários do fórum:', e)
    }
  }, [comentarios])

  function aoEnviarComentario() {
    if (!novoTexto.trim()) return

    const novo: ComentarioForum = {
      id: `c_${Date.now()}`,
      dataIso: new Date().toISOString().substring(0, 10),
      autorNome: autorNomeInput.trim() || 'Usuário',
      criadoEm: new Date().toISOString(),
      texto: novoTexto.trim(),
      respostas: [],
    }

    setComentarios((prev) => [novo, ...prev])
    setNovoTexto('')
  }

  function aoEnviarResposta(comentarioId: string) {
    if (!textoRespostaInput.trim()) return

    const novaResposta: RespostaForum = {
      id: `r_${Date.now()}`,
      autorNome: autorNomeInput.trim() || 'Usuário',
      criadoEm: new Date().toISOString(),
      texto: textoRespostaInput.trim(),
    }

    setComentarios((prev) =>
      prev.map((c) =>
        c.id === comentarioId
          ? { ...c, respostas: [...c.respostas, novaResposta] }
          : c,
      ),
    )

    setTextoRespostaInput('')
    setIdRespostaAtiva(null)
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
              <UserAvatar nome={autorNomeInput} size={28} />
              <TextInput
                placeholder="Seu nome..."
                value={autorNomeInput}
                onChange={(e) => setAutorNomeInput(e.currentTarget.value)}
                size="xs"
                style={{ width: 180 }}
              />
            </Group>
            <Textarea
              placeholder="Escreva um comentário ou orientação sobre o desempenho do dia..."
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.currentTarget.value)}
              minRows={2}
              autosize
            />
            <Group justify="flex-end">
              <Button size="xs" color="blue" onClick={aoEnviarComentario} disabled={!novoTexto.trim()}>
                Publicar Comentário
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Lista de Comentários / Threads */}
        {comentarios.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum comentário ainda"
            descricao="Seja o primeiro a registrar uma nota ou orientação sobre o dia."
          />
        ) : (
        <Stack gap="md" mt="sm">
          {comentarios.map((item) => (
            <Paper key={item.id} p="md" radius="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <UserAvatar nome={item.autorNome} size={32} />
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
                  <Stack gap="xs" ml="lg" mt="xs" style={{ borderLeft: '2px solid var(--superficie-borda)', paddingLeft: 12 }}>
                    {item.respostas.map((resp) => (
                      <Paper key={resp.id} p="xs" radius="sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                        <Group gap="xs" align="flex-start">
                          <UserAvatar nome={resp.autorNome} size={24} />
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
                          onClick={() => aoEnviarResposta(item.id)}
                          disabled={!textoRespostaInput.trim()}
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
        )}
      </Stack>
    </Card>
  )
}
