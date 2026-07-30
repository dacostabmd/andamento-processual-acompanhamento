import { STATUS_LABELS } from '../types/domain'
import type {
  FiltrosDashboard,
  MetricasTarefas,
  PacoteAtendimento,
  Tarefa,
  VisaoDashboard,
} from '../types/domain'
import { contarPorEquipe, periodoAtendivel } from './aiAssistant/agregacao'
import { baseSyncApi, fetchSyncApi } from './syncApi'
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
import {
  extrairIntencao,
  mesclarComContexto,
  type Intencao,
} from './aiAssistant/intencao'

export interface MensagemChat {
  id: string
  remetente: 'user' | 'assistant'
  texto: string
  timestamp: string
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
        return `- Equipe "${c.equipe}": fechou ${c.fechadas} tarefa(s) (${statusFechadas || 'nenhum status'}); tem ${c.comResponsavelNoTime} tarefa(s) como responsável/participante (${statusResp || 'nenhum status'})`
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

    resumoColaboradoresAtendimento = pacotes
      .map((p) => {
        const departamentos = p.cards.find((c) => c.fechadoPorDepartamentos.length > 0)
          ?.fechadoPorDepartamentos.join(', ')
        const deptoInfo = departamentos ? ` | Departamentos: ${departamentos}` : ''
        return `- Colaborador(a) "${p.responsavelAtendimentoNome}": Equipe "${p.equipe}" (${p.cards.length} tarefas)${deptoInfo}`
      })
      .join('\n')

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
        const pert = info.ehDaEquipe ? 'Pertence a equipe de atendimento' : 'FORA das 4 equipes de atendimento'
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

[Contagem por Equipe — Fechadas (closedBy) × Com Responsável (participante), por status]
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
3. Responda de forma direta, cortês e fundamentada EXCLUSIVAMENTE nos dados acima.
4. Formate a resposta em Markdown limpo (bullets, negritos, destaques).
`.trim()
}

export async function enviarMensagemAssistente(
  mensagens: MensagemChat[],
  contexto: ContextoDashboard,
): Promise<string> {
  const ultimaMensagem = mensagens[mensagens.length - 1]
  if (!ultimaMensagem || ultimaMensagem.remetente !== 'user') {
    throw new Error('Última mensagem inválida para resposta do assistente.')
  }

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
          // o card ou a do participante. Sem isto, a IA podia responder por
          // equipe_atendimento enquanto o dashboard mostrava equipe_executora —
          // dois números diferentes para a mesma pergunta, na mesma tela.
          visao: contexto.visao ?? 'atendimento',
        }),
      })

      if (respostaWorker.ok) {
        const json = await respostaWorker.json()
        if (json.resposta) return json.resposta
      } else {
        // Sem `else`, um 401 (token errado) ou 429 (limite) era indistinguível de
        // "worker offline" e caía calado no fallback local, que responde com
        // números diferentes — o usuário não tinha como saber que mudou de motor.
        console.warn(
          `[IA] Worker respondeu HTTP ${respostaWorker.status}; usando fallback local.`,
        )
      }
    } catch (err) {
      console.warn('Falha ao consultar endpoint Text-to-SQL do Worker, tentando fallback de cliente:', err)
    }
  }

  // 2. Chamada direta de cliente se VITE_LLM_API_KEY estiver presente
  const apiKey = import.meta.env.VITE_LLM_API_KEY?.trim()
  const apiUrl = import.meta.env.VITE_LLM_API_URL?.trim() || 'https://api.openai.com/v1/chat/completions'

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
        if (conteudo) return conteudo
      }
    } catch (err) {
      console.warn('Falha na chamada da API LLM direta, utilizando fallback local:', err)
    }
  }

  // 3. Fallback analítico inteligente local para dev/demo offline
  return gerarRespostaSimuladaInteligente(ultimaMensagem.texto, contexto, mensagens)
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
): string {
  const agora = new Date()

  if (!contexto.metricas) return MSG_CARREGANDO

  const cards = achatarCards(contexto)

  // 1. Fora de escopo (antes de tudo).
  const intencaoBruta = extrairIntencao(pergunta, cards, agora)
  if (intencaoBruta.foraDeEscopo === 'escrita') return MSG_SOMENTE_LEITURA
  if (intencaoBruta.foraDeEscopo === 'foraDominio') return MSG_FORA_DOMINIO

  // 2. Follow-up: herdar dimensões faltantes do contexto anterior.
  const anterior = ultimaIntencaoDoHistorico(historico, cards, agora)
  const intencao = mesclarComContexto(intencaoBruta, anterior)

  // 3. Suposições declaradas (para rodapé).
  registrarSuposicoes(intencao)

  // 4. Casos degenerados -> esclarecimento.
  if (intencao.metrica === 'desconhecida' && intencao.entidade.tipo === 'nenhuma') {
    // Sem período e sem nada: pedir esclarecimento geral.
    if (intencao.periodo.tipo === 'nenhum') return comporEsclarecimento('geral')
    // "Me fala sobre a semana": período sem métrica -> resumo do período.
    intencao.metrica = 'resumo'
  }
  if (
    intencao.entidade.tipo !== 'nenhuma' &&
    intencao.entidade.valorCanonico === null &&
    !intencao.entidade.todas
  ) {
    return comporEsclarecimento(intencao.entidade.tipo)
  }

  // 5. Viabilidade temporal: só recortes que dependem de finalizadoEm/janela.
  // A guarda usa o POOL COMPLETO (não o slice da entidade): o que importa é se
  // a janela pedida começa antes do início da cobertura de dados em memória. Um
  // slice de entidade sem conclusões no período é um "0" legítimo, não uma
  // lacuna de cobertura.
  if (dependeDeHistorico(intencao)) {
    const via = periodoAtendivel(cards, intencao.periodo)
    if (!via.ok) return comporLimitacao(via.motivo ?? '', intencao.periodo)
  }

  // 6. Tendência: não temos série histórica confiável no modo offline.
  if (intencao.agrupamento === 'tendencia') {
    return comporLimitacao('janela-excede-dados-em-memoria', intencao.periodo)
  }

  // 7. Despacho por (agrupamento, métrica) — combinação, não cascata.
  if (intencao.agrupamento === 'ranking') return comporRanking(cards, intencao, agora)
  if (intencao.agrupamento === 'comparacao') return comporComparacao(cards, intencao, agora)
  if (intencao.agrupamento === 'detalhe') return comporDetalhe(cards, intencao, agora)

  if (intencao.metrica === 'explicacao') return comporExplicacao(cards, intencao, agora)
  if (intencao.metrica === 'detalhe') return comporDetalhe(cards, intencao, agora)
  if (intencao.metrica === 'porEquipe') return comporContagemPorEquipe(cards, intencao)
  if (intencao.metrica === 'resumo') return comporResumo(cards, intencao, agora)
  if (intencao.metrica === 'taxaAtrasoAtiva' || intencao.metrica === 'taxaAtrasoTotal')
    return comporTaxa(cards, intencao, agora)

  // Escalar simples: entidade × métrica × período.
  return comporEscalar(cards, intencao, agora)
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
