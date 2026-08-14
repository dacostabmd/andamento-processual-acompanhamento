import { STATUS_LABELS } from '../types/domain'
import type {
  FiltrosDashboard,
  MetricasTarefas,
  PacoteAtendimento,
  Tarefa,
  VisaoDashboard,
} from '../types/domain'
import { ROTULO_AUSENCIA_LEGIVEL, ehNomeDePessoa } from '../utils/pessoas'
import { contarPorEquipe, periodoAtendivel } from './aiAssistant/agregacao'
import type { DadosGrafico, RespostaComposta } from './aiAssistant/grafico'
import { baseSyncApi, descreverErroHttp, fetchSyncApi } from './syncApi'
import {
  comporComparacao,
  comporContagemPorEquipe,
  comporDetalhe,
  comporEsclarecimento,
  comporEscalar,
  comporExplicacao,
  comporLimitacao,
  comporRanking,
  comporResumo,
  comporTaxa,
  MSG_CARREGANDO,
  MSG_FORA_DOMINIO,
  MSG_SOMENTE_LEITURA,
} from './aiAssistant/composicao'
import { extrairIntencao, mesclarComContexto, type Intencao } from './aiAssistant/intencao'

export interface MensagemChat {
  id: string
  remetente: 'user' | 'assistant'
  texto: string
  timestamp: string
  /** Tarefas do resultado, renderizadas como links de verdade. Ver TarefaLink. */
  tarefas?: TarefaLink[]
  /** Gráfico de barras do resultado, quando o dado é um agrupamento categórico. */
  grafico?: DadosGrafico
}

/**
 * Uma tarefa do resultado, com o link montado pelo SERVIDOR.
 *
 * Antes o worker já devolvia isto em `json.tarefas` e o frontend jogava fora,
 * porque `enviarMensagemAssistente` retornava apenas string. Os links chegavam
 * só dentro do texto que o LLM escrevia — o que custava caro em dois eixos:
 *
 *  - latência: uma URL do Bitrix tem ~90 caracteres, e o modelo digitava até 20
 *    delas token por token. Era a maior parte do tempo de geração da resposta, e
 *    o que empurrava a pergunta de listagem para além do timeout do proxy (504).
 *  - correção: um caractere errado numa URL longa quebra o link em silêncio, e
 *    transcrever URL é exatamente o tipo de tarefa em que LLM erra.
 *
 * Com o link vindo estruturado, ele é sempre exatamente o que o servidor montou.
 */
export interface TarefaLink {
  id: number
  link: string | null
  titulo?: string
  /** Quem concluiu o card — presente quando a consulta trouxe fechado_por_nome. */
  fechadoPorNome?: string
  /** Equipe de quem fechou (equipe_executora) — presente quando a consulta a trouxe. */
  equipe?: string
  /** Status em texto (status_label) — presente quando a consulta o trouxe. */
  statusLabel?: string
  /** Data/hora de conclusão, ISO 8601 — presente só em tarefas já concluídas. */
  finalizadoEm?: string
}

/**
 * Dados prontos para desenhar um gráfico de barras a partir da resposta.
 *
 * Vem estruturado (não é o assistente "decidindo" mostrar gráfico em texto)
 * pelo mesmo motivo de `TarefaLink`: o que soubermos de antemão sobre a forma
 * do dado (aqui, "é um pequeno agrupamento categórico"), a interface desenha
 * — o LLM não digita números de eixo nem inventa formatação de barra.
 *
 * Reexportado de aiAssistant/grafico (módulo de base) para quem só conhece
 * este service, como o componente de chat.
 */
export type { DadosGrafico }

/** Resposta do assistente: o texto e, quando houver, tarefas ou gráfico a renderizar. */
export interface RespostaAssistente {
  texto: string
  tarefas?: TarefaLink[]
  grafico?: DadosGrafico
}

/**
 * Remove do texto a lista de tarefas que o modelo escreveu à mão.
 *
 * Necessário durante a transição: a Vercel publica o frontend na hora, mas o
 * worker só atualiza no `git pull` da VPS. Enquanto o worker antigo estiver no
 * ar, ele continua mandando "- Tarefa 123 — TÍTULO: https://..." dentro do
 * texto; sem esta limpeza a lista apareceria DUAS vezes — a do modelo e a
 * renderizada. Com o worker novo não há nada para remover e a função é inócua.
 */
export function removerListaEscritaPeloModelo(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => !/^\s*[-*]\s*Tarefa\s+\d+/i.test(linha))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Valida o `grafico` que o worker devolveu antes de confiar nele.
 *
 * O corpo da resposta vem de `fetch().json()` — tipado como `any` — e o worker
 * é um serviço externo que pode estar numa versão mais antiga (o deploy dele
 * não acompanha o da Vercel). Sem esta validação, um `grafico` ausente,
 * incompleto ou com arrays de tamanhos diferentes chegaria direto ao
 * componente de gráfico e quebraria o Chart.js em vez de simplesmente não
 * mostrar gráfico nenhum.
 */
function validarGraficoDoWorker(valor: unknown): DadosGrafico | undefined {
  if (!valor || typeof valor !== 'object') return undefined
  const g = valor as Record<string, unknown>
  if (!Array.isArray(g.categorias) || !Array.isArray(g.valores)) return undefined
  if (g.categorias.length === 0 || g.categorias.length !== g.valores.length) return undefined
  if (!g.categorias.every((c) => typeof c === 'string')) return undefined
  if (!g.valores.every((v) => typeof v === 'number' && Number.isFinite(v))) return undefined
  return {
    categorias: g.categorias as string[],
    valores: g.valores as number[],
    ...(typeof g.rotuloValor === 'string' ? { rotuloValor: g.rotuloValor } : {}),
    ...(typeof g.titulo === 'string' ? { titulo: g.titulo } : {}),
  }
}

interface ContextoDashboard {
  metricas: MetricasTarefas | null
  pacotes: PacoteAtendimento[] | null
  filtros: FiltrosDashboard
  /**
   * Dimensão de agrupamento ativa na tela. Repassada ao worker para a IA
   * responder pela mesma noção de "equipe" que o dashboard está exibindo.
   */
  visao?: VisaoDashboard
}

export function construirPromptContextual(contexto: ContextoDashboard): string {
  const { metricas, pacotes, filtros } = contexto

  const cards = pacotes ? pacotes.flatMap((p) => p.cards) : []

  let resumoMetricas = 'Métricas indisponíveis no momento.'
  if (metricas) {
    resumoMetricas = `
- Total de tarefas analisadas: ${metricas.total}
- Concluídas: ${metricas.concluidas} (${metricas.eficiencia.toFixed(1)}% eficiência)
- Atrasadas: ${metricas.atrasadas}
- Taxa de atraso ativa: ${metricas.taxaAtraso.toFixed(1)}%
- Em andamento (no prazo): ${metricas.emAndamento}
- Risco de atraso (vencem nos próximos 3 dias): ${metricas.vencemEmBreve}
- Aguardando controle/revisão: ${metricas.aguardandoRevisao}
`.trim()
  }

  let resumoEquipes = 'Nenhum dado por equipe disponível.'
  let resumoColaboradoresAtendimento = 'Nenhum colaborador de atendimento disponível.'
  let resumoFechadores = 'Nenhum dado de fechamento disponível.'
  let resumoFechamentoEquipes = 'Nenhum dado disponível.'
  let resumoContagemPorEquipe = 'Nenhum dado disponível.'

  if (cards.length > 0) {
    resumoContagemPorEquipe = contarPorEquipe(cards)
      .map((c) => {
        const statusFechadas = (Object.entries(c.statusFechadas) as Array<[string, number]>)
          .filter(([, n]) => n > 0)
          .map(([s, n]) => `${n} ${STATUS_LABELS[Number(s) as 2 | 3 | 4 | 5 | 6].toLowerCase()}`)
          .join(', ')
        const statusResp = (Object.entries(c.statusResponsavel) as Array<[string, number]>)
          .filter(([, n]) => n > 0)
          .map(([s, n]) => `${n} ${STATUS_LABELS[Number(s) as 2 | 3 | 4 | 5 | 6].toLowerCase()}`)
          .join(', ')
        return `- Equipe "${c.equipe}": fechou ${c.fechadas} tarefa(s) (${statusFechadas || 'nenhum status'}); tem ${c.comResponsavelNoTime} tarefa(s) como equipe de atendimento (${statusResp || 'nenhum status'})`
      })
      .join('\n')
  }

  if (pacotes && pacotes.length > 0) {
    const equipesMap = new Map<string, { total: number; responsaveis: number }>()
    pacotes.forEach((p) => {
      const atual = equipesMap.get(p.equipe) ?? { total: 0, responsaveis: 0 }
      equipesMap.set(p.equipe, {
        total: atual.total + p.cards.length,
        responsaveis: atual.responsaveis + 1,
      })
    })

    resumoEquipes = Array.from(equipesMap.entries())
      .map(
        ([eq, dados]) =>
          `- Equipe "${eq}": ${dados.total} tarefas distribuídas entre ${dados.responsaveis} responsável(is)`,
      )
      .join('\n')

    /**
     * Por que os pacotes SEM responsável identificável saem da lista de
     * colaboradores.
     *
     * O worker rotula esses cards como "Responsável Indefinido" para os
     * gráficos. Listados aqui como `Colaborador(a) "Responsável Indefinido"`,
     * eles se tornavam indistinguíveis de uma pessoa para o modelo — e como a
     * maioria dos cards abertos não tem atendente identificável, esse era o
     * maior número da seção. Resultado medido em produção: "o responsável com
     * mais tarefas vencendo hoje é 'Responsável Indefinido', com 4.375 tarefas".
     *
     * O total não é escondido: ele vira uma linha explícita de AUSÊNCIA, fora da
     * lista de pessoas, para o modelo poder citá-lo como lacuna de cadastro sem
     * nunca tratá-lo como alguém.
     */
    const pacotesComPessoa = pacotes.filter((p) => ehNomeDePessoa(p.responsavelAtendimentoNome))
    const cardsSemResponsavel = pacotes
      .filter((p) => !ehNomeDePessoa(p.responsavelAtendimentoNome))
      .reduce((soma, p) => soma + p.cards.length, 0)

    resumoColaboradoresAtendimento = pacotesComPessoa
      .map((p) => {
        const departamentos = p.cards
          .find((c) => c.fechadoPorDepartamentos.length > 0)
          ?.fechadoPorDepartamentos.join(', ')
        const deptoInfo = departamentos ? ` | Departamentos: ${departamentos}` : ''
        return `- Colaborador(a) "${p.responsavelAtendimentoNome}": Equipe "${p.equipe}" (${p.cards.length} tarefas)${deptoInfo}`
      })
      .join('\n')

    if (cardsSemResponsavel > 0) {
      resumoColaboradoresAtendimento +=
        `\n- (NÃO É PESSOA) ${cardsSemResponsavel} tarefas estão ${ROTULO_AUSENCIA_LEGIVEL}: ` +
        `o Bitrix não registra atendente nesses cards. Isto é uma LACUNA DE CADASTRO, ` +
        `nunca um colaborador — jamais cite como nome de pessoa nem inclua em ranking de pessoas.`
    }

    // Fechamento de tarefas por colaborador (campo fechadoPorNome)
    const NOMES_DEPARTAMENTO_EQUIPES = [
      'Andamento Cinthia Filgueiras',
      'Andamento Simone Freitas',
      'Andamento Quézia Karen',
      'Andamento Lorena Pontes',
    ]

    const fechadoresMap = new Map<
      string,
      { count: number; ehDaEquipe: boolean; deptos: string[] }
    >()
    let concluidasTotal = 0
    let concluidasDentroEquipes = 0
    let concluidasForaEquipes = 0

    cards.forEach((c) => {
      if (c.status === 5) {
        concluidasTotal++
        const nome = c.fechadoPorNome || 'Não informado'
        const ehDaEquipe = c.fechadoPorDepartamentos.some((d) =>
          NOMES_DEPARTAMENTO_EQUIPES.includes(d.trim()),
        )
        if (ehDaEquipe) concluidasDentroEquipes++
        else concluidasForaEquipes++

        const atual = fechadoresMap.get(nome) ?? {
          count: 0,
          ehDaEquipe,
          deptos: c.fechadoPorDepartamentos,
        }
        atual.count++
        if (c.fechadoPorDepartamentos.length > 0) atual.deptos = c.fechadoPorDepartamentos
        fechadoresMap.set(nome, atual)
      }
    })

    resumoFechamentoEquipes = `
- Total de tarefas concluídas (status=5): ${concluidasTotal}
- Concluídas por colaboradores DAS 4 equipes de atendimento: ${concluidasDentroEquipes}
- Concluídas por colaboradores FORA das 4 equipes de atendimento: ${concluidasForaEquipes}
`.trim()

    resumoFechadores = Array.from(fechadoresMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([nome, info]) => {
        const pert = info.ehDaEquipe
          ? 'Pertence a equipe de atendimento'
          : 'FORA das 4 equipes de atendimento'
        const deptosStr = info.deptos.length > 0 ? ` | Deptos: ${info.deptos.join(', ')}` : ''
        return `- Colaborador(a) "${nome}": ${info.count} tarefas fechadas | Status: ${pert}${deptosStr}`
      })
      .join('\n')
  }

  const resumoFiltros = `
- Período: ${filtros.dataInicio ?? 'Início não definido'} até ${filtros.dataFim ?? 'sem limite (futuro)'}
- Status selecionado: ${filtros.status}
- Setor: ${filtros.setor ?? 'Todos'}
- Estado (UF): ${filtros.estado ?? 'Todos os estados'}
- Ocultar indefinidos: ${filtros.ocultarIndefinidos ? 'Sim' : 'Não'}
- Ocultar fora das equipes: ${filtros.ocultarForaDasEquipes ? 'Sim' : 'Não'}
`.trim()

  return `
Você é o assistente virtual de inteligência artificial do Dashboard de Andamento Processual de um escritório de advocacia.
Seu objetivo é analisar os dados operacionais do sistema e responder às perguntas do usuário com extrema precisão estatística e factual.

DADOS ATUAIS EM TEMPO REAL NO DASHBOARD (FILTRADOS):

[Métricas Gerais]
${resumoMetricas}

[Volume por Equipe de Atendimento]
${resumoEquipes}

[Contagem por Equipe — Fechadas (closedBy) × Equipe de Atendimento (supervisor do fechador, com fallback para o supervisor do responsável), por status]
${resumoContagemPorEquipe}

[Mapeamento dos Responsáveis pelo Atendimento]
${resumoColaboradoresAtendimento}

[Fechamento de Tarefas / Pessoas que Concluíram Tarefas ("Fechado Por")]
${resumoFechamentoEquipes}

[Ranking Completo de Pessoas que Fecharam Tarefas ("Fechado Por")]
${resumoFechadores}

[Filtros Ativos Aplicados]
${resumoFiltros}

INSTRUÇÕES DE RESPOSTA CRÍTICAS:
1. ATENÇÃO À DIFERENÇA ENTRE "Responsável pelo Atendimento" E "Fechado Por" (quem concluiu a tarefa):
   - "Responsável pelo Atendimento" são as pessoas alocadas no acompanhamento das equipes de atendimento.
   - "Fechado Por" são os colaboradores que efetivamente CONCLUÍRAM/FECHARAM as tarefas.
2. SOBRE COLABORADORES FORA DAS EQUIPES (ex: Victoria Persi, Gabriela Monteiro, Ana Catarina, etc.):
   - Existem colaboradores que NÃO pertencem às 4 equipes de atendimento (ex: pertencem aos setores de NEGOCIAÇÃO E ACORDOS ou FINANCEIRO) mas fecham tarefas no sistema.
   - Exemplo importante: **Victoria Persi** é uma colaboradora FORA das 4 equipes de atendimento que fechou o maior volume de tarefas no sistema.
   - Quando o usuário perguntar "quantos cards foram fechados por pessoas que não são das equipes?", consulte a seção [Fechamento de Tarefas] e informe a quantidade exata de tarefas fechadas fora das equipes.
   - Quando o usuário perguntar especificamente por **Victoria Persi**, confirme que ela existe no sistema, informe que ela é uma colaboradora fora das 4 equipes de atendimento e diga o número exato de tarefas que ela fechou.
3. NUNCA trate ausência de dado como pessoa. "Responsável Indefinido", "Não informado",
   "indefinido" e similares são RÓTULOS DE AUSÊNCIA de cadastro, não colaboradores.
   - É PROIBIDO respondê-los como resposta de "quem"/"qual responsável"/"quem mais".
   - Se o maior volume estiver nesse balde, diga que N tarefas estão sem responsável
     identificado E dê o maior valor ENTRE AS PESSOAS DE VERDADE.
4. Responda de forma direta, cortês e fundamentada EXCLUSIVAMENTE nos dados acima.
5. Formate a resposta em Markdown limpo (bullets, negritos, destaques).
`.trim()
}

export async function enviarMensagemAssistente(
  mensagens: MensagemChat[],
  contexto: ContextoDashboard,
): Promise<RespostaAssistente> {
  const ultimaMensagem = mensagens[mensagens.length - 1]
  if (!ultimaMensagem || ultimaMensagem.remetente !== 'user') {
    throw new Error('Última mensagem inválida para resposta do assistente.')
  }

  /**
   * Por que a falha do worker é RASTREADA em vez de só logada.
   *
   * O `console.warn` era invisível para o gestor: o Text-to-SQL falhava e o
   * fallback local de palavra-chave respondia no lugar dele, com a mesma
   * aparência de confiança e números calculados por outro critério. Em produção
   * isso produziu "Há 287 tarefas de Bruno Borges" para a pergunta "quais as
   * últimas tarefas do grupo 86" — e atribuir a causa exigiu cinco rodadas de
   * investigação, porque o único lugar que sabia o status HTTP era um log de
   * console que ninguém tinha aberto.
   *
   * Uma resposta errada com cara de certa é pior que um erro. O motivo agora
   * sobe junto com a resposta degradada.
   */
  let motivoFalhaWorker: string | null = null

  // 1. Prioridade: Text-to-SQL no worker (LangChain + GPT-4 sobre o PostgreSQL).
  if (baseSyncApi()) {
    try {
      const respostaWorker = await fetchSyncApi('/query-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pergunta: ultimaMensagem.texto,
          historico: mensagens
            .slice(0, -1)
            .slice(-8)
            .map((m) => ({
              remetente: m.remetente,
              texto: m.texto,
            })),
          filtros: contexto.filtros,
          // A visão ativa na tela decide se "equipe" significa a de quem fechou
          // o card ou a do supervisor de atendimento. Sem isto, a IA podia
          // responder por equipe_atendimento enquanto o dashboard mostrava
          // equipe_executora — dois números diferentes para a mesma pergunta,
          // na mesma tela.
          visao: contexto.visao ?? 'atendimento',
        }),
      })

      if (respostaWorker.ok) {
        const json = await respostaWorker.json()
        if (json.resposta) {
          const tarefas: TarefaLink[] = Array.isArray(json.tarefas) ? json.tarefas : []
          const grafico = validarGraficoDoWorker(json.grafico)
          return {
            // Só limpa quando há lista estruturada para pôr no lugar: sem
            // `tarefas`, a lista escrita pelo modelo é a única que existe.
            texto: tarefas.length ? removerListaEscritaPeloModelo(json.resposta) : json.resposta,
            ...(tarefas.length ? { tarefas } : {}),
            ...(grafico ? { grafico } : {}),
          }
        }
        // 200 com corpo sem `resposta` é contrato quebrado, não ausência de
        // dado — cair calado aqui esconderia um bug do worker.
        motivoFalhaWorker = 'o servidor respondeu sem conteúdo (HTTP 200 sem resposta)'
        console.warn('[IA] Worker respondeu 200 sem campo `resposta`; usando fallback local.')
      } else {
        // Sem `else`, um 401 (token errado) ou 429 (limite) era indistinguível de
        // "worker offline" e caía calado no fallback local, que responde com
        // números diferentes — o usuário não tinha como saber que mudou de motor.
        motivoFalhaWorker = `${descreverErroHttp(respostaWorker.status, baseSyncApi() ?? '')} (HTTP ${respostaWorker.status})`
        console.warn(`[IA] Worker respondeu HTTP ${respostaWorker.status}; usando fallback local.`)
      }
    } catch (err) {
      // Rede, CORS, timeout de proxy e abort caem todos aqui — e são justamente
      // os que não deixam status HTTP para trás.
      motivoFalhaWorker = `não foi possível alcançar o servidor de análise (${err instanceof Error ? err.message : 'erro de rede'})`
      console.warn(
        'Falha ao consultar endpoint Text-to-SQL do Worker, tentando fallback de cliente:',
        err,
      )
    }
  }

  // 2. Chamada direta de cliente se VITE_LLM_API_KEY estiver presente
  const apiKey = import.meta.env.VITE_LLM_API_KEY?.trim()
  const apiUrl =
    import.meta.env.VITE_LLM_API_URL?.trim() || 'https://api.openai.com/v1/chat/completions'

  if (apiKey) {
    try {
      const systemPrompt = construirPromptContextual(contexto)
      const payloadMensagens = [
        { role: 'system', content: systemPrompt },
        ...mensagens.map((m) => ({
          role: m.remetente === 'user' ? 'user' : 'assistant',
          content: m.texto,
        })),
      ]

      const resposta = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: payloadMensagens,
          temperature: 0.3,
        }),
      })

      if (resposta.ok) {
        const json = await resposta.json()
        const conteudo = json.choices?.[0]?.message?.content
        // Nível 2 fala com a LLM direto do browser, sem passar pelo banco: não
        // há tarefas estruturadas a renderizar aqui.
        if (conteudo) return { texto: conteudo }
      }
    } catch (err) {
      console.warn('Falha na chamada da API LLM direta, utilizando fallback local:', err)
    }
  }

  // 3. Fallback analítico inteligente local para dev/demo offline
  const respostaLocal = gerarRespostaSimuladaInteligente(ultimaMensagem.texto, contexto, mensagens)

  // O motor que respondeu tem de ficar explícito. O fallback local decide por
  // palavra-chave sobre os cards já em memória: não faz SQL, não vê o banco
  // inteiro e não sabe recusar uma pergunta que não entendeu — ele sempre
  // devolve algum número. Sem este aviso, o gestor lê esse número como se
  // tivesse vindo da análise completa.
  if (motivoFalhaWorker) {
    return {
      texto:
        `> ⚠️ **Modo limitado.** Não consegui usar a análise completa do servidor ` +
        `(${motivoFalhaWorker}), então respondi a partir dos dados já carregados na ` +
        `tela — o que pode não cobrir a sua pergunta. Vale reenviar em alguns instantes.\n\n` +
        respostaLocal.texto,
      ...(respostaLocal.grafico ? { grafico: respostaLocal.grafico } : {}),
    }
  }

  return respostaLocal
}

/**
 * Achata os pacotes em um único pool de cards. Cada pacote já reflete os
 * filtros ativos do dashboard, então o pool é a base fiel para recomputar
 * qualquer métrica por qualquer recorte.
 */
function achatarCards(contexto: ContextoDashboard): Tarefa[] {
  return (contexto.pacotes ?? []).flatMap((p) => p.cards)
}

/**
 * Reconstrói a última intenção resolvida a partir do histórico de mensagens do
 * usuário (todas menos a atual), para servir de contexto herdável em
 * follow-ups. Sem estado mutável de módulo — derivado do histórico a cada
 * chamada, o que evita vazamento de estado entre abas/sessões.
 */
function ultimaIntencaoDoHistorico(
  mensagens: MensagemChat[],
  cards: Tarefa[],
  agora: Date,
): Intencao | null {
  const anteriores = mensagens.filter((m) => m.remetente === 'user')
  // A última do array é a pergunta atual; queremos a imediatamente anterior.
  const anterior = anteriores[anteriores.length - 2]
  if (!anterior) return null
  return extrairIntencao(anterior.texto, cards, agora)
}

/**
 * Motor de fallback offline: decompõe a pergunta em 4 dimensões ortogonais
 * (métrica × entidade × período × agrupamento), herda o que faltar do contexto
 * anterior, checa a viabilidade temporal e compõe a resposta a partir dos cards
 * em memória — nunca inventa números fora do que os filtros trouxeram.
 */
export function gerarRespostaSimuladaInteligente(
  pergunta: string,
  contexto: ContextoDashboard,
  historico: MensagemChat[] = [],
): RespostaComposta {
  const agora = new Date()

  if (!contexto.metricas) return { texto: MSG_CARREGANDO }

  const cards = achatarCards(contexto)

  // 1. Fora de escopo (antes de tudo).
  const intencaoBruta = extrairIntencao(pergunta, cards, agora)
  if (intencaoBruta.foraDeEscopo === 'escrita') return { texto: MSG_SOMENTE_LEITURA }
  if (intencaoBruta.foraDeEscopo === 'foraDominio') return { texto: MSG_FORA_DOMINIO }

  // 2. Follow-up: herdar dimensões faltantes do contexto anterior.
  const anterior = ultimaIntencaoDoHistorico(historico, cards, agora)
  const intencao = mesclarComContexto(intencaoBruta, anterior)

  // 3. Suposições declaradas (para rodapé).
  registrarSuposicoes(intencao)

  // 4. Casos degenerados -> esclarecimento.
  if (intencao.metrica === 'desconhecida' && intencao.entidade.tipo === 'nenhuma') {
    // Sem período e sem nada: pedir esclarecimento geral.
    if (intencao.periodo.tipo === 'nenhum') return { texto: comporEsclarecimento('geral') }
    // "Me fala sobre a semana": período sem métrica -> resumo do período.
    intencao.metrica = 'resumo'
  }
  if (
    intencao.entidade.tipo !== 'nenhuma' &&
    intencao.entidade.valorCanonico === null &&
    !intencao.entidade.todas
  ) {
    return { texto: comporEsclarecimento(intencao.entidade.tipo) }
  }

  // 5. Viabilidade temporal: só recortes que dependem de finalizadoEm/janela.
  // A guarda usa o POOL COMPLETO (não o slice da entidade): o que importa é se
  // a janela pedida começa antes do início da cobertura de dados em memória. Um
  // slice de entidade sem conclusões no período é um "0" legítimo, não uma
  // lacuna de cobertura.
  if (dependeDeHistorico(intencao)) {
    const via = periodoAtendivel(cards, intencao.periodo)
    if (!via.ok) return { texto: comporLimitacao(via.motivo ?? '', intencao.periodo) }
  }

  // 6. Tendência: não temos série histórica confiável no modo offline.
  if (intencao.agrupamento === 'tendencia') {
    return { texto: comporLimitacao('janela-excede-dados-em-memoria', intencao.periodo) }
  }

  // 7. Despacho por (agrupamento, métrica) — combinação, não cascata.
  // Ranking e comparação podem vir com `grafico`; os demais compositores
  // ainda respondem só em texto (o dado deles é escalar ou já é uma lista).
  if (intencao.agrupamento === 'ranking') return comporRanking(cards, intencao, agora)
  if (intencao.agrupamento === 'comparacao') return comporComparacao(cards, intencao, agora)
  if (intencao.agrupamento === 'detalhe') return { texto: comporDetalhe(cards, intencao, agora) }

  if (intencao.metrica === 'explicacao') return { texto: comporExplicacao(cards, intencao, agora) }
  if (intencao.metrica === 'detalhe') return { texto: comporDetalhe(cards, intencao, agora) }
  if (intencao.metrica === 'porEquipe') return { texto: comporContagemPorEquipe(cards, intencao) }
  if (intencao.metrica === 'resumo') return { texto: comporResumo(cards, intencao, agora) }
  if (intencao.metrica === 'taxaAtrasoAtiva' || intencao.metrica === 'taxaAtrasoTotal')
    return { texto: comporTaxa(cards, intencao, agora) }

  // Escalar simples: entidade × métrica × período.
  return { texto: comporEscalar(cards, intencao, agora) }
}

/** Uma métrica/agrupamento que dependa de finalizadoEm ou janela histórica. */
function dependeDeHistorico(intencao: Intencao): boolean {
  if (intencao.periodo.tipo === 'nenhum') return false
  return intencao.metrica === 'rendimento' || intencao.agrupamento === 'tendencia'
}

/** Popula intencao.suposicoes com as ambiguidades resolvidas por default. */
function registrarSuposicoes(intencao: Intencao): void {
  // "produtividade/rendimento" sem período virou 'concluidas'.
  if (
    intencao.metrica === 'concluidas' &&
    /produtiv|rendimento|desempenho/.test(intencao.textoNormalizado) &&
    intencao.periodo.tipo === 'nenhum'
  ) {
    intencao.suposicoes.push(
      'Considerei todas as tarefas concluídas (sem recorte de período). Se quiser um período específico, é só dizer (ex.: "esta semana").',
    )
  }
  // "melhor/pior" ambíguo assumiu rendimento/conclusões.
  if (
    /\bmelhor\b/.test(intencao.textoNormalizado) &&
    (intencao.metrica === 'concluidas' || intencao.metrica === 'rendimento') &&
    !/conclui|finaliz|fechou|produtiv|rendimento/.test(intencao.textoNormalizado)
  ) {
    intencao.suposicoes.push('Interpretei "melhor" como maior volume de conclusões.')
  }
}
