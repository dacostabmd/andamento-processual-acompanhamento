import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  enviarMensagemAssistente,
  type MensagemChat,
  type TarefaLink,
} from '../../services/aiAssistantService'
import type {
  FiltrosDashboard,
  MetricasTarefas,
  PacoteAtendimento,
  VisaoDashboard,
} from '../../types/domain'
import classes from './AiAssistantChat.module.css'

interface AiAssistantChatProps {
  metricas: MetricasTarefas | null
  pacotes: PacoteAtendimento[] | null
  /** Visão ativa na tela; repassada à IA para ela usar a mesma noção de equipe. */
  visao?: VisaoDashboard
  filtros: FiltrosDashboard
}

function BolinhasLoadingIA() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 2px' }}>
      <span style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.85, marginRight: '2px' }}>
        Analisando os dados
      </span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'var(--mantine-color-dourado-4, #cba556)',
            display: 'inline-block',
          }}
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatDelay: 0.1,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/** Estilo compartilhado por todo link renderizado na bolha do assistente. */
const ESTILO_LINK: React.CSSProperties = {
  color: 'var(--mantine-color-blue-4)',
  textDecoration: 'underline',
  wordBreak: 'break-word',
}

/**
 * Uma linha de tarefa escrita pelo modelo, no formato que o worker pedia:
 * "- Tarefa 2717103 — TÍTULO : https://portal/.../view/2717103/"
 *
 * Reconhecer o formato é o que torna a resposta legível sem depender da versão do
 * worker: a URL do Bitrix tem ~90 caracteres e, impressa como texto, quebra em
 * três linhas e enterra o título. Aqui ela vira o próprio "Tarefa <id>" clicável.
 */
const LINHA_DE_TAREFA = /^\s*[-*]\s*Tarefa\s+(\d+)\s*[—–-]?\s*(.*?)\s*:\s*(https?:\/\/\S+)\s*$/i

/** URL solta em qualquer outro lugar do texto. */
const URL_SOLTA = /(https?:\/\/\S+)/g

/**
 * Converte URLs soltas em links curtos. Imprimir a URL inteira não informa nada
 * ao gestor — ele quer clicar, não ler o caminho do endpoint.
 */
type NoDeTexto = string | React.ReactElement

function renderizarComLinks(nos: NoDeTexto[]): NoDeTexto[] {
  return nos.flatMap<NoDeTexto>((no, indiceNo) => {
    if (typeof no !== 'string') return [no]
    return no.split(URL_SOLTA).map<NoDeTexto>((parte, i) => {
      if (!/^https?:\/\//.test(parte)) return parte
      return (
        <a
          key={`${indiceNo}-${i}`}
          href={parte}
          target="_blank"
          rel="noopener noreferrer"
          style={ESTILO_LINK}
        >
          abrir
        </a>
      )
    })
  })
}

function renderizarConteudoComMarkdown(texto: string) {
  const linhas = texto.split('\n')

  return (
    <div>
      {linhas.map((linha, index) => {
        // Linha de tarefa vem antes de qualquer outro tratamento: é o caso em que
        // a formatação padrão produzia o resultado ilegível.
        const tarefa = linha.match(LINHA_DE_TAREFA)
        if (tarefa) {
          const [, id, titulo, url] = tarefa
          return (
            <div key={index} style={{ marginBottom: '3px', fontSize: '12px', lineHeight: 1.45 }}>
              <a href={url} target="_blank" rel="noopener noreferrer" style={ESTILO_LINK}>
                Tarefa {id}
              </a>
              {titulo ? <span style={{ opacity: 0.85 }}> — {titulo}</span> : null}
            </div>
          )
        }

        let processado = linha
        const isHeader3 = processado.startsWith('### ')
        const isHeader2 = processado.startsWith('## ')
        const isHeader1 = processado.startsWith('# ')

        if (isHeader3) processado = processado.replace(/^###\s+/, '')
        else if (isHeader2) processado = processado.replace(/^##\s+/, '')
        else if (isHeader1) processado = processado.replace(/^#\s+/, '')

        const partesBold = processado.split(/(\*\*.*?\*\*)/g)
        const elementosLinha = renderizarComLinks(
          partesBold.map((parte, i) => {
            if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
              return <strong key={i} style={{ fontWeight: 700 }}>{parte.slice(2, -2)}</strong>
            }
            return parte
          }),
        )

        if (isHeader3 || isHeader2 || isHeader1) {
          return (
            <div key={index} style={{ fontWeight: 700, fontSize: '14px', marginTop: '6px', marginBottom: '4px' }}>
              {elementosLinha}
            </div>
          )
        }

        if (linha.trim() === '') {
          return <div key={index} style={{ height: '4px' }} />
        }

        return (
          <div key={index} style={{ marginBottom: '2px' }}>
            {elementosLinha}
          </div>
        )
      })}
    </div>
  )
}

/** Quantas tarefas a bolha mostra antes de resumir o resto. */
const MAX_TAREFAS_VISIVEIS = 20

/**
 * Lista de tarefas do resultado, com link clicável montado pelo SERVIDOR.
 *
 * Substitui a lista que o modelo escrevia dentro do texto. Além de eliminar o
 * tempo de geração das URLs (o que empurrava a pergunta de listagem para além do
 * timeout do proxy), garante que o link seja exatamente o que o worker montou —
 * transcrever URL de ~90 caracteres é justamente onde um LLM erra em silêncio.
 */
function ListaTarefasComLink({ tarefas }: { tarefas: TarefaLink[] }) {
  const visiveis = tarefas.slice(0, MAX_TAREFAS_VISIVEIS)
  const restantes = tarefas.length - visiveis.length

  return (
    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {visiveis.map((t) => (
        <div key={t.id} style={{ fontSize: '12px', lineHeight: 1.45 }}>
          {t.link ? (
            <a
              href={t.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--mantine-color-blue-4)', textDecoration: 'underline' }}
            >
              Tarefa {t.id}
            </a>
          ) : (
            <span>Tarefa {t.id}</span>
          )}
          {t.titulo ? <span style={{ opacity: 0.85 }}> — {t.titulo}</span> : null}
        </div>
      ))}
      {restantes > 0 && (
        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
          e mais {restantes} {restantes === 1 ? 'tarefa' : 'tarefas'}.
        </div>
      )}
    </div>
  )
}

export function AiAssistantChat({ metricas, pacotes, filtros, visao }: AiAssistantChatProps) {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [textoInput, setTextoInput] = useState('')
  const [carregando, setCarregando] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (aberto) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens, aberto])

  const handleEnviar = async () => {
    const texto = textoInput.trim()
    if (!texto || carregando) return

    const mensagemUsuario: MensagemChat = {
      id: String(Date.now()),
      remetente: 'user',
      texto,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const novasMensagens = [...mensagens, mensagemUsuario]
    setMensagens(novasMensagens)
    setTextoInput('')
    setCarregando(true)

    try {
      const respostaAssistente = await enviarMensagemAssistente(novasMensagens, {
        metricas,
        pacotes,
        filtros,
        visao,
      })

      const mensagemIa: MensagemChat = {
        id: String(Date.now() + 1),
        remetente: 'assistant',
        texto: respostaAssistente.texto,
        ...(respostaAssistente.tarefas?.length ? { tarefas: respostaAssistente.tarefas } : {}),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMensagens((prev) => [...prev, mensagemIa])
    } catch (err) {
      const mensagemErro: MensagemChat = {
        id: String(Date.now() + 1),
        remetente: 'assistant',
        texto: 'Desculpe, ocorreu um erro ao consultar o assistente de IA. Tente novamente em instantes.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMensagens((prev) => [...prev, mensagemErro])
    } finally {
      setCarregando(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  return (
    <>
      {/* Botão Acionador Flutuante (Floating Action Button) */}
      <button
        type="button"
        className={classes.floatingTrigger}
        onClick={() => setAberto((prev) => !prev)}
        aria-label={aberto ? 'Fechar Assistente IA' : 'Abrir Assistente IA'}
        title={aberto ? 'Fechar Assistente IA' : 'Abrir Assistente IA'}
      >
        {aberto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.112L2 22l1.112-5.413A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z" />
            <circle cx="8.5" cy="12" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="15.5" cy="12" r="1" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Janela de Chat Flutuante */}
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={classes.chatWidgetContainer}
          >
            {/* Header */}
            <div className={classes.header}>
              <div className={classes.headerTitleGroup}>
                <span className={classes.statusDot} />
                <span className={classes.headerTitle}>Ajudante Virtual do Andamento Processual</span>
              </div>

              <div className={classes.headerBadges}>
                <button
                  type="button"
                  className={classes.closeButton}
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

            </div>

            {/* Área de Mensagens */}
            <div className={classes.messagesArea}>
              {mensagens.length === 0 ? (
                <div className={classes.emptyStateText}>
                  O que você gostaria de explorar hoje? Faça perguntas, tire dúvidas sobre as métricas ou solicite análises do dashboard...
                </div>
              ) : (
                mensagens.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className={`${classes.mensagemBubble} ${
                      m.remetente === 'user' ? classes.userBubble : classes.assistantBubble
                    }`}
                  >
                    {renderizarConteudoComMarkdown(m.texto)}
                    {m.tarefas?.length ? <ListaTarefasComLink tarefas={m.tarefas} /> : null}
                  </motion.div>
                ))
              )}
              {carregando && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className={`${classes.mensagemBubble} ${classes.assistantBubble}`}
                >
                  <BolinhasLoadingIA />
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>



          {/* Input Card */}
          <div className={classes.inputCard}>
            <textarea
              className={classes.textarea}
              placeholder="Pergunte qualquer coisa sobre os dados ou métricas..."
              value={textoInput}
              onChange={(e) => setTextoInput(e.target.value.slice(0, 2000))}
              onKeyDown={handleKeyDown}
              rows={2}
            />

            <div className={classes.toolbar}>
              <div className={classes.sendControls}>
                <span className={classes.charCounter}>{textoInput.length}/2000</span>
                <button
                  type="button"
                  className={classes.sendButton}
                  onClick={handleEnviar}
                  disabled={!textoInput.trim() || carregando}
                  title="Enviar mensagem"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>


          {/* Rodapé Informacional */}
          <div className={classes.footerInfo}>
            <span>
              Pressione <span className={classes.kbd}>Shift + Enter</span> para nova linha
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}



