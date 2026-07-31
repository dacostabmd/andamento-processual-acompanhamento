import { STATUS_LABELS, type StatusTarefa, type Tarefa } from '../../types/domain'
import {
  cardsDoRendimento,
  contar,
  contarPorEquipe,
  filtrarPorEntidade,
  PREDICADOS,
  ranquear,
  rendimento,
  resumoSlice,
  taxaAtraso,
  type ContagemEquipe,
  type TipoDimensaoGrupo,
} from './agregacao'
import type { Entidade, Intencao, Periodo, TipoMetrica } from './intencao'

/**
 * Compositores de resposta em Markdown compatível com
 * renderizarConteudoComMarkdown (suporta **bold**, #, bullets `-`).
 */

// ---------------------------------------------------------------------------
// Mensagens fixas
// ---------------------------------------------------------------------------

export const MSG_CARREGANDO =
  'Os dados das métricas ainda estão sendo carregados. Por favor, aguarde alguns instantes e tente novamente.'

export const MSG_SOMENTE_LEITURA =
  'Sou um assistente de **consulta e leitura**. Não executo exclusões, edições ou criação de tarefas — apenas analiso os dados do dashboard. Posso, por exemplo, te mostrar quantas tarefas estão concluídas ou atrasadas, se quiser.'

export const MSG_FORA_DOMINIO =
  'Só consigo responder sobre o **andamento processual** (tarefas, prazos, equipes, atrasos, rendimento). Sobre isso, no que posso ajudar?'

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

function pct(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`
}

function rotuloEntidade(e: Entidade): string {
  if (e.valorCanonico === null) return ''
  switch (e.tipo) {
    case 'equipe':
      return e.valorCanonico === 'indefinido'
        ? 'da **equipe indefinida**'
        : `da **equipe ${e.valorCanonico}**`
    case 'pessoa':
      return `de **${e.valorCanonico}**`
    case 'setor':
      return `do **setor ${e.valorCanonico}**`
    case 'uf':
      return `em **${e.valorCanonico}**`
    case 'projeto':
      return `no **projeto ${e.valorCanonico}**`
    default:
      return ''
  }
}

function rodapeSuposicoes(intencao: Intencao): string {
  if (intencao.suposicoes.length === 0) return ''
  return `\n\n*${intencao.suposicoes.join(' ')}*`
}

const NOME_METRICA_SUBSTANTIVO: Record<string, string> = {
  total: 'tarefas no total',
  concluidas: 'tarefas concluídas',
  ativas: 'tarefas em aberto',
  atrasadas: 'tarefas atrasadas',
  emAndamentoNoPrazo: 'tarefas em andamento no prazo',
  riscoAtraso: 'tarefas em risco de atraso',
  aguardandoControle: 'tarefas aguardando controle',
  rendimento: 'tarefas concluídas',
}

// ---------------------------------------------------------------------------
// Escalar (entidade × métrica × período)
// ---------------------------------------------------------------------------

export function comporEscalar(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const slice = filtrarPorEntidade(cards, intencao.entidade)
  const alvo = rotuloEntidade(intencao.entidade)
  const sufixoEntidade = alvo ? ` ${alvo}` : ''

  if (intencao.metrica === 'rendimento') {
    const valor = rendimento(slice, intencao.periodo)
    const per = intencao.periodo.rotulo ? ` ${intencao.periodo.rotulo}` : ''
    return (
      `Foram **${valor} tarefas concluídas**${sufixoEntidade}${per} ` +
      `(por data de conclusão).${rodapeSuposicoes(intencao)}`
    )
  }

  const valor = contar(slice, intencao.metrica, agora)
  const nome = NOME_METRICA_SUBSTANTIVO[intencao.metrica] ?? 'tarefas'
  return `Há **${valor} ${nome}**${sufixoEntidade}.${rodapeSuposicoes(intencao)}`
}

// ---------------------------------------------------------------------------
// Taxa de atraso
// ---------------------------------------------------------------------------

export function comporTaxa(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const slice = filtrarPorEntidade(cards, intencao.entidade)
  const modo = intencao.metrica === 'taxaAtrasoTotal' ? 'total' : 'ativas'
  const t = taxaAtraso(slice, modo, agora)
  const alvo = rotuloEntidade(intencao.entidade)
  const sufixoEntidade = alvo ? ` ${alvo}` : ''
  const baseLabel = modo === 'total' ? 'do total de tarefas' : 'das tarefas ativas'
  return (
    `A **taxa de atraso**${sufixoEntidade} é de **${pct(t.percentual)}** ` +
    `(${t.atrasadas} atrasadas de ${t.denominador} ${baseLabel}).${rodapeSuposicoes(intencao)}`
  )
}

// ---------------------------------------------------------------------------
// Resumo multi-métrica
// ---------------------------------------------------------------------------

export function comporResumo(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const slice = filtrarPorEntidade(cards, intencao.entidade)
  const r = resumoSlice(slice, agora)
  const alvo = rotuloEntidade(intencao.entidade)
  const escopo = alvo ? ` ${alvo.replace(/^(da|de|do|em|no) /, '')}` : ' geral'
  const per = intencao.periodo.rotulo ? ` (${intencao.periodo.rotulo})` : ''

  const linhas = [
    `**Resumo${escopo}**${per}:`,
    `- **Total**: ${r.total} tarefas`,
    `- **Concluídas**: ${r.concluidas}`,
    `- **Em aberto (ativas)**: ${r.ativas}`,
    `- **Em andamento no prazo**: ${r.emAndamentoNoPrazo}`,
    `- **Atrasadas**: ${r.atrasadas} (taxa de atraso: **${pct(r.taxaAtrasoAtiva)}**)`,
    `- **Risco de atraso (próximos 3 dias)**: ${r.riscoAtraso}`,
    `- **Aguardando controle**: ${r.aguardandoControle}`,
  ]

  // Se houver período, adicionar o rendimento do período como linha extra.
  if (intencao.periodo.tipo !== 'nenhum') {
    linhas.push(`- **Concluídas no período**: ${rendimento(slice, intencao.periodo)}`)
  }

  return linhas.join('\n') + rodapeSuposicoes(intencao)
}

// ---------------------------------------------------------------------------
// Contagem por equipe (fechadas × com responsável, com detalhamento por status)
// ---------------------------------------------------------------------------

function linhaStatus(porStatus: Record<StatusTarefa, number>): string {
  const ordem: StatusTarefa[] = [5, 3, 2, 4, 6]
  return ordem
    .filter((s) => porStatus[s] > 0)
    .map((s) => `${porStatus[s]} ${STATUS_LABELS[s].toLowerCase()}`)
    .join(', ')
}

function linhaEquipe(c: ContagemEquipe): string {
  const statusFechadas = linhaStatus(c.statusFechadas)
  const statusResp = linhaStatus(c.statusResponsavel)
  return (
    `- **${c.equipe}**: fechou **${c.fechadas}** tarefa(s)${statusFechadas ? ` (${statusFechadas})` : ''}; ` +
    `tem **${c.comResponsavelNoTime}** tarefa(s) como responsável${statusResp ? ` (${statusResp})` : ''}`
  )
}

/**
 * Responde "quantas tarefas cada equipe fechou / tem / está com atraso", com o
 * detalhamento por status pedido explicitamente: fechadas via `closedBy`
 * (equipe do fechador), e "como responsável" via equipe do supervisor de quem
 * fechou — ou do supervisor do responsável pelo atendimento, em fallback —
 * (`equipeAtendimento`) — as duas contagens não se sobrepõem necessariamente,
 * um card pode ter equipe de atendimento diferente da equipe de quem o fechou.
 */
export function comporContagemPorEquipe(cards: Tarefa[], intencao: Intencao): string {
  const linhas = contarPorEquipe(cards).map(linhaEquipe)
  const semEquipe = cards.filter(
    (c) => c.equipeAtendimento === 'indefinido' && c.equipeFechador === 'indefinido',
  ).length

  return (
    [`**Tarefas por equipe** (Cinthia Filgueiras, Simone Freitas, Quézia Karen, Lorena Pontes):`, ...linhas].join(
      '\n',
    ) +
    (semEquipe > 0
      ? `\n\n${semEquipe} tarefa(s) não têm responsável nem fechador identificáveis em nenhuma das 4 equipes.`
      : '') +
    rodapeSuposicoes(intencao)
  )
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

const NOME_DIMENSAO: Record<TipoDimensaoGrupo, string> = {
  equipe: 'equipe',
  pessoa: 'colaborador(a)',
  setor: 'setor',
  uf: 'estado',
  projeto: 'projeto',
}

function ehTaxa(metrica: TipoMetrica): boolean {
  return metrica === 'taxaAtrasoAtiva' || metrica === 'taxaAtrasoTotal'
}

export function comporRanking(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const dimensao = (intencao.entidade.tipo === 'nenhuma' ? 'equipe' : intencao.entidade.tipo) as TipoDimensaoGrupo
  const querPior = /\bpior\b|\bmenos\b|\bmenor\b/.test(intencao.textoNormalizado)
  const ordem = querPior ? 'asc' : 'desc'
  const metrica = intencao.metrica === 'desconhecida' || intencao.metrica === 'resumo' ? 'total' : intencao.metrica

  const itens = ranquear(cards, dimensao, metrica, intencao.periodo, agora, ordem).filter(
    (i) => i.chave && i.chave !== 'Não informado',
  )

  if (itens.length === 0) {
    return `Não encontrei dados suficientes para ranquear por ${NOME_DIMENSAO[dimensao]} com os filtros atuais.${rodapeSuposicoes(intencao)}`
  }

  const nomeMetrica = ehTaxa(metrica)
    ? 'taxa de atraso'
    : metrica === 'rendimento'
      ? 'tarefas concluídas'
      : (NOME_METRICA_SUBSTANTIVO[metrica] ?? 'tarefas')
  const per = intencao.periodo.rotulo ? ` ${intencao.periodo.rotulo}` : ''
  const superlativo = querPior ? 'menor' : 'maior'

  const top = itens.slice(0, 5)
  const linhas = [
    `**Ranking por ${NOME_DIMENSAO[dimensao]}** (${nomeMetrica}${per}, ${superlativo} primeiro):`,
    ...top.map((i, idx) => {
      const v = ehTaxa(metrica) ? pct(i.valor) : `${i.valor}`
      return `${idx + 1}. **${i.chave}**: ${v}`
    }),
  ]
  return linhas.join('\n') + rodapeSuposicoes(intencao)
}

// ---------------------------------------------------------------------------
// Comparação (duas entidades)
// ---------------------------------------------------------------------------

function valorParaComparacao(
  cards: Tarefa[],
  e: Entidade,
  intencao: Intencao,
  agora: Date,
): number {
  const slice = filtrarPorEntidade(cards, e)
  if (intencao.metrica === 'rendimento') return rendimento(slice, intencao.periodo)
  if (ehTaxa(intencao.metrica)) {
    const modo = intencao.metrica === 'taxaAtrasoTotal' ? 'total' : 'ativas'
    return taxaAtraso(slice, modo, agora).percentual
  }
  const m = intencao.metrica === 'desconhecida' || intencao.metrica === 'resumo' ? 'total' : intencao.metrica
  return contar(slice, m, agora)
}

export function comporComparacao(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const a = intencao.entidade
  const b = intencao.entidadeSecundaria
  if (!b || b.valorCanonico === null || a.valorCanonico === null) {
    // Sem duas entidades: cai em ranking, que já cobre "compara os setores".
    return comporRanking(cards, intencao, agora)
  }

  const va = valorParaComparacao(cards, a, intencao, agora)
  const vb = valorParaComparacao(cards, b, intencao, agora)
  const taxa = ehTaxa(intencao.metrica)
  const fmt = (v: number) => (taxa ? pct(v) : `${v}`)

  const nomeMetrica = taxa
    ? 'taxa de atraso'
    : intencao.metrica === 'rendimento'
      ? 'tarefas concluídas'
      : (NOME_METRICA_SUBSTANTIVO[intencao.metrica] ?? 'tarefas')
  const per = intencao.periodo.rotulo ? ` ${intencao.periodo.rotulo}` : ''

  let veredito: string
  if (va === vb) veredito = 'Empate entre as duas.'
  else {
    // Para taxa de atraso, "melhor" é o MENOR valor; para as demais, o maior.
    const lider =
      va > vb
        ? taxa
          ? b.valorCanonico
          : a.valorCanonico
        : taxa
          ? a.valorCanonico
          : b.valorCanonico
    veredito = `**${lider}** ${taxa ? 'tem a menor taxa de atraso' : 'lidera'}.`
  }

  return (
    `**Comparação de ${nomeMetrica}**${per}:\n` +
    `- **${a.valorCanonico}**: ${fmt(va)}\n` +
    `- **${b.valorCanonico}**: ${fmt(vb)}\n\n` +
    veredito +
    rodapeSuposicoes(intencao)
  )
}

// ---------------------------------------------------------------------------
// Detalhe (lista de cards)
// ---------------------------------------------------------------------------

const LIMITE_DETALHE = 10

/** Filtra cards pela combinação entidade × métrica (sem contar, para listar). */
export function filtrarComposto(cards: Tarefa[], intencao: Intencao, agora: Date): Tarefa[] {
  const slice = filtrarPorEntidade(cards, intencao.entidade)
  if (intencao.metrica === 'rendimento') return cardsDoRendimento(slice, intencao.periodo)
  const pred =
    intencao.metrica === 'total' ||
    intencao.metrica === 'desconhecida' ||
    intencao.metrica === 'resumo' ||
    intencao.metrica === 'detalhe' ||
    intencao.metrica === 'explicacao'
      ? null
      : intencao.metrica
  if (!pred) return slice
  const fn = PREDICADOS[pred]
  return fn ? slice.filter((c) => fn(c, agora)) : slice
}

export function comporDetalhe(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const lista = filtrarComposto(cards, intencao, agora)
  if (lista.length === 0) {
    return `Não encontrei tarefas que correspondam a esse recorte com os filtros atuais.${rodapeSuposicoes(intencao)}`
  }
  const alvo = rotuloEntidade(intencao.entidade)
  const nome = NOME_METRICA_SUBSTANTIVO[intencao.metrica] ?? 'tarefas'
  const cabecalho = `**${lista.length} ${nome}**${alvo ? ` ${alvo}` : ''}${
    lista.length > LIMITE_DETALHE ? ` (mostrando as ${LIMITE_DETALHE} primeiras)` : ''
  }:`

  const linhas = lista.slice(0, LIMITE_DETALHE).map((c) => {
    const prazo = formatarData(c.prazoFinal)
    const status = STATUS_LABELS[c.status] ?? `status ${c.status}`
    const resp = c.responsavelAtendimentoNome ?? c.responsavelNome ?? 'sem responsável'
    return `- **${c.titulo}** — prazo ${prazo} · ${status} · ${resp}`
  })

  return [cabecalho, ...linhas].join('\n') + rodapeSuposicoes(intencao)
}

function formatarData(iso: string | null): string {
  if (!iso) return 'sem prazo'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

// ---------------------------------------------------------------------------
// Explicação (decompõe o último agregado)
// ---------------------------------------------------------------------------

export function comporExplicacao(cards: Tarefa[], intencao: Intencao, agora: Date): string {
  const lista = filtrarComposto(cards, intencao, agora)
  const alvo = rotuloEntidade(intencao.entidade)
  const nome = NOME_METRICA_SUBSTANTIVO[intencao.metrica] ?? 'tarefas'
  if (lista.length === 0) {
    return `Esse número vem de **0 ${nome}**${alvo ? ` ${alvo}` : ''} com os filtros atuais — não há cards que se enquadrem nesse recorte.${rodapeSuposicoes(intencao)}`
  }

  const introducao = `O número de **${lista.length} ${nome}**${alvo ? ` ${alvo}` : ''} é composto por estas tarefas:`
  const linhas = lista.slice(0, LIMITE_DETALHE).map((c) => {
    const prazo = formatarData(c.prazoFinal)
    const resp = c.responsavelAtendimentoNome ?? c.responsavelNome ?? 'sem responsável'
    return `- **${c.titulo}** — prazo ${prazo} · ${resp}`
  })
  const rodapeLista =
    lista.length > LIMITE_DETALHE ? `\n\n(mostrando ${LIMITE_DETALHE} de ${lista.length})` : ''
  return [introducao, ...linhas].join('\n') + rodapeLista + rodapeSuposicoes(intencao)
}

// ---------------------------------------------------------------------------
// Limitação temporal honesta
// ---------------------------------------------------------------------------

export function comporLimitacao(_motivo: string, periodo: Periodo): string {
  const per = periodo.rotulo || 'esse período'
  return (
    `Esse recorte por período (**${per}**) depende do histórico de conclusões, ` +
    `que não está totalmente disponível neste modo offline — os dados em memória ` +
    `cobrem apenas o que os filtros atuais do dashboard trouxeram (por prazo, não ` +
    `por data de conclusão). Para um número confiável nesse período, tente novamente ` +
    `quando o worker de análise estiver disponível, ou ajuste o filtro de período do ` +
    `dashboard para cobrir o intervalo desejado.`
  )
}

// ---------------------------------------------------------------------------
// Esclarecimento (pergunta de volta)
// ---------------------------------------------------------------------------

export function comporEsclarecimento(dimensaoFaltante: string): string {
  switch (dimensaoFaltante) {
    case 'equipe':
      return 'Sobre qual equipe você quer saber? As equipes de atendimento são **Cinthia Filgueiras**, **Simone Freitas**, **Quézia Karen** e **Lorena Pontes** (além da equipe indefinida).'
    case 'uf':
      return 'Sobre qual estado (UF) você quer saber? Posso filtrar por qualquer UF presente nos dados atuais.'
    case 'setor':
      return 'Sobre qual setor/departamento você quer saber?'
    case 'projeto':
      return 'Sobre qual projeto você quer saber?'
    case 'pessoa':
      return 'Sobre qual colaborador(a) você quer saber?'
    default:
      return 'Não consegui identificar exatamente o que você quer. Posso informar contagens (total, concluídas, atrasadas, em risco), taxas de atraso, rendimento por período, ou rankings por equipe/estado/setor/projeto. Sobre o que gostaria de saber?'
  }
}
