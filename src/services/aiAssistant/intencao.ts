import { EQUIPES_ATENDIMENTO, type Tarefa } from '../../types/domain'
import { nomeDePessoaOuNulo } from '../../utils/pessoas'

/**
 * Extração dimensional de intenção para o fallback offline do assistente.
 *
 * A pergunta do usuário é decomposta em 4 dimensões ortogonais — métrica,
 * entidade, período e agrupamento — extraídas de forma independente. Nenhuma
 * palavra isolada ("semana", "equipe", "mês") dispara um bloco inteiro: cada
 * uma popula apenas a sua dimensão. As dimensões são combinadas depois, na
 * fase de composição da resposta.
 *
 * Este módulo é 100% puro (sem DOM, sem estado global), o que o torna
 * diretamente testável.
 */

export type TipoMetrica =
  | 'total'
  | 'concluidas'
  | 'ativas'
  | 'atrasadas'
  | 'emAndamentoNoPrazo'
  | 'riscoAtraso'
  | 'aguardandoControle'
  | 'taxaAtrasoAtiva'
  | 'taxaAtrasoTotal'
  | 'rendimento' // status=5 dentro de um período por finalizadoEm
  | 'porEquipe' // fechadas × com responsável, por cada uma das 4 equipes, com status
  | 'resumo' // painel multi-métrica
  | 'detalhe' // listar cards
  | 'explicacao' // decompor último número
  | 'desconhecida'

export type TipoEntidade =
  | 'equipe'
  | 'pessoa'
  | 'setor'
  | 'uf'
  | 'projeto'
  | 'prioridade'
  | 'nenhuma'

export interface Entidade {
  tipo: TipoEntidade
  /** Ex.: 'Quézia Karen' (com acento), 'SP', 'Negociação'. null = "qual?". */
  valorCanonico: string | null
  /** O texto que o usuário digitou (para exibir de volta em esclarecimentos). */
  valorBruto: string | null
  /** true quando é ranking/comparação sobre todas as instâncias da dimensão. */
  todas: boolean
  /** 0..1, confiança do fuzzy-match. */
  confiancaMatch: number
}

export type TipoPeriodo =
  | 'nenhum'
  | 'hoje'
  | 'ultimos7dias'
  | 'ultimos30dias'
  | 'mesCorrente'
  | 'mesPassado'
  | 'trimestre'
  | 'ano'

export interface Periodo {
  tipo: TipoPeriodo
  inicio: Date | null
  fim: Date | null
  rotulo: string
}

export type TipoAgrupamento = 'nenhum' | 'ranking' | 'comparacao' | 'tendencia' | 'detalhe'

export interface Intencao {
  metrica: TipoMetrica
  entidade: Entidade
  /** Para comparação ("Cinthia vs Simone"). */
  entidadeSecundaria: Entidade | null
  periodo: Periodo
  agrupamento: TipoAgrupamento
  foraDeEscopo: 'escrita' | 'foraDominio' | null
  textoNormalizado: string
  /** Suposições feitas ao resolver ambiguidades (exibidas em rodapé). */
  suposicoes: string[]
}

export function entidadeVazia(): Entidade {
  return { tipo: 'nenhuma', valorCanonico: null, valorBruto: null, todas: false, confiancaMatch: 0 }
}

// ---------------------------------------------------------------------------
// Normalização de texto (base de tudo)
// ---------------------------------------------------------------------------

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distância de Levenshtein (para tolerância a typos em nomes). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const linhaAnterior = new Array<number>(b.length + 1)
  const linhaAtual = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) linhaAnterior[j] = j

  for (let i = 0; i < a.length; i++) {
    linhaAtual[0] = i + 1
    for (let j = 0; j < b.length; j++) {
      const custo = a[i] === b[j] ? 0 : 1
      linhaAtual[j + 1] = Math.min(
        linhaAtual[j] + 1, // inserção
        linhaAnterior[j + 1] + 1, // remoção
        linhaAnterior[j] + custo, // substituição
      )
    }
    for (let j = 0; j <= b.length; j++) linhaAnterior[j] = linhaAtual[j]
  }
  return linhaAnterior[b.length]
}

// ---------------------------------------------------------------------------
// Léxico de métricas
// ---------------------------------------------------------------------------

/**
 * A ordem do array é a ordem de especificidade: quando várias métricas casam
 * e não há regra de desempate explícita, vence a que aparece primeiro aqui.
 * `total` é sempre o piso (só vence se nada mais casou).
 */
const LEXICO_METRICA: Array<{ metrica: TipoMetrica; termos: string[] }> = [
  {
    metrica: 'rendimento',
    termos: ['rendimento', 'produtividade', 'produtiv', 'desempenho', 'produziu', 'produzir'],
  },
  {
    metrica: 'concluidas',
    termos: ['conclui', 'concluid', 'finaliz', 'fechou', 'fechad', 'fechar', 'entregue', 'entreg'],
  },
  {
    metrica: 'atrasadas',
    termos: ['atrasad', 'atraso', 'vencid', 'estourou', 'pepino', 'em atraso'],
  },
  { metrica: 'taxaAtrasoAtiva', termos: ['taxa de atraso', 'percentual de atraso', '% de atraso'] },
  {
    metrica: 'riscoAtraso',
    termos: ['risco', 'vencem em breve', 'prestes a vencer', 'proximos 3 dias', 'a vencer'],
  },
  {
    metrica: 'aguardandoControle',
    termos: ['aguardando controle', 'aguardando revisao', 'em revisao', 'controle'],
  },
  {
    metrica: 'emAndamentoNoPrazo',
    termos: ['no prazo', 'dentro do prazo', 'em andamento no prazo'],
  },
  {
    metrica: 'ativas',
    termos: [
      'aberto',
      'em aberto',
      'pendente',
      'ativa',
      'ativas',
      'em andamento',
      'tocando',
      'sob responsabilidade',
    ],
  },
  { metrica: 'total', termos: ['total', 'quantas tarefa', 'quantos', 'volume'] },
  {
    metrica: 'resumo',
    termos: [
      'resumo',
      'panorama',
      'visao geral',
      'como esta',
      'como estao',
      'me fala sobre',
      'me da um resumo',
    ],
  },
  { metrica: 'detalhe', termos: ['detalh', 'quais tarefas', 'lista', 'listar', 'mostra as'] },
  { metrica: 'explicacao', termos: ['por que', 'porque', 'explica'] },
]

/**
 * Termos que pedem a repartição por equipe (fechadas × com responsável, com
 * status). Fora do LEXICO_METRICA principal de propósito: é um pedido de
 * FORMATO de resposta ("quebra por equipe"), não concorre por especificidade
 * com "atrasadas"/"concluidas" — o texto pode trazer as duas coisas juntas
 * ("quantas cada equipe fechou" é 'porEquipe', não 'total' genérico).
 */
const TERMOS_POR_EQUIPE = [
  'por equipe',
  'de cada equipe',
  'cada equipe',
  'cada time',
  'por time',
  'entre as equipes',
  'entre os times',
  'todas as equipes',
]

function mencionaPorEquipe(txt: string): boolean {
  return TERMOS_POR_EQUIPE.some((t) => txt.includes(t))
}

/** Detecta menção explícita de percentual/taxa (para desempatar taxa vs contagem). */
function mencionaTaxa(txt: string): boolean {
  return /taxa|percentual|% |porcent/.test(txt)
}

function mencionaSobreTotal(txt: string): boolean {
  return /sobre o total|do total|em relacao ao total/.test(txt)
}

export function extrairMetrica(txt: string, temPeriodo: boolean): TipoMetrica {
  const casadas = LEXICO_METRICA.filter((l) => l.termos.some((t) => txt.includes(t)))
  const set = new Set(casadas.map((c) => c.metrica))

  // Taxa: presença explícita de "taxa/percentual/%" tem prioridade sobre a
  // contagem simples de atrasadas.
  if (mencionaTaxa(txt) && (set.has('atrasadas') || set.has('taxaAtrasoAtiva'))) {
    return mencionaSobreTotal(txt) ? 'taxaAtrasoTotal' : 'taxaAtrasoAtiva'
  }

  // "por equipe"/"cada equipe" sem outro eixo de agrupamento nomeado (pessoa,
  // setor, uf, projeto) pede a repartição fechadas×responsável por time. Fica
  // fora do LEXICO_METRICA para não competir por especificidade com
  // atrasadas/concluidas — é um pedido de formato, não de métrica.
  if (mencionaPorEquipe(txt) && !set.has('taxaAtrasoAtiva')) return 'porEquipe'

  if (set.size === 0) return 'desconhecida'

  // Regra 1: conclusão/produtividade + período => rendimento (usa finalizadoEm).
  if ((set.has('concluidas') || set.has('rendimento')) && temPeriodo) return 'rendimento'
  // "produtividade" sem período: assumir 'concluidas' (status=5) — a suposição
  // é declarada na composição da resposta.
  if (set.has('rendimento') && !temPeriodo) return 'concluidas'

  // Especificidade pela ordem do léxico; 'total' é o piso.
  for (const l of LEXICO_METRICA) {
    if (set.has(l.metrica) && l.metrica !== 'total') return l.metrica
  }
  return 'total'
}

// ---------------------------------------------------------------------------
// Período — sempre janela relativa calculada em runtime
// ---------------------------------------------------------------------------

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function somaDias(d: Date, dias: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

function inicioMes(d: Date, offset: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1, 0, 0, 0, 0)
}

function fimMes(d: Date, offset: number): Date {
  // Último instante do mês (dia 0 do mês seguinte = último dia do mês alvo).
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0, 23, 59, 59, 999)
}

function inicioTrimestre(d: Date): Date {
  const mesInicial = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), mesInicial, 1, 0, 0, 0, 0)
}

function inicioAno(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
}

export function extrairPeriodo(txt: string, agora: Date): Periodo {
  const mk = (
    tipo: TipoPeriodo,
    inicio: Date | null,
    fim: Date | null,
    rotulo: string,
  ): Periodo => ({ tipo, inicio, fim, rotulo })

  if (/\bhoje\b/.test(txt)) return mk('hoje', inicioDoDia(agora), agora, 'hoje')

  // Mês passado antes de "últimos 30 dias" e "este mês" (é mais específico).
  if (/mes passado|mes anterior|ultimo mes/.test(txt)) {
    return mk('mesPassado', inicioMes(agora, -1), fimMes(agora, -1), 'no mês passado')
  }
  if (/este mes|neste mes|mes corrente|mes atual|do mes|no mes/.test(txt)) {
    return mk('mesCorrente', inicioMes(agora, 0), agora, 'neste mês')
  }
  if (/ultimos? 30 dias|ultimos? trinta dias/.test(txt)) {
    return mk('ultimos30dias', somaDias(agora, -30), agora, 'nos últimos 30 dias')
  }
  if (
    /ultimos? 7 dias|ultimos? sete dias|ultima semana|essa semana|esta semana|\ba semana\b|na semana|da semana|semana corrente/.test(
      txt,
    )
  ) {
    return mk('ultimos7dias', somaDias(agora, -7), agora, 'nos últimos 7 dias')
  }
  if (/trimestre/.test(txt)) {
    return mk('trimestre', inicioTrimestre(agora), agora, 'neste trimestre')
  }
  if (/este ano|neste ano|ano corrente|ano atual|no ano|do ano|ao longo do ano/.test(txt)) {
    return mk('ano', inicioAno(agora), agora, 'neste ano')
  }
  return mk('nenhum', null, null, '')
}

// ---------------------------------------------------------------------------
// Agrupamento
// ---------------------------------------------------------------------------

export function extrairAgrupamento(txt: string): TipoAgrupamento {
  if (/compara|comparar|versus|\bvs\b|diferenca entre|entre .+ e /.test(txt)) return 'comparacao'
  if (/evolu|ao longo|mes a mes|tendencia|\bpico\b|serie|melhorou ou piorou/.test(txt))
    return 'tendencia'
  if (/ranking|ordena|do maior|do menor|top \d|classific/.test(txt)) return 'ranking'
  if (
    /\bmelhor\b|\bpior\b|mais |menos |qual (equipe|estado|setor|projeto|pessoa|colaborador|time)/.test(
      txt,
    )
  )
    return 'ranking'
  if (/detalh|quais tarefas|lista|listar|mostra as/.test(txt)) return 'detalhe'
  return 'nenhum'
}

// ---------------------------------------------------------------------------
// Fora de escopo
// ---------------------------------------------------------------------------

export function detectarForaDeEscopo(txt: string): 'escrita' | 'foraDominio' | null {
  if (
    /apag|delet|remov|exclu|altera|edita|atualiza o status|muda o status|cria (uma )?tarefa/.test(
      txt,
    )
  )
    return 'escrita'
  if (/chover|previsao do tempo|\bclima\b|piada|futebol|noticia/.test(txt)) return 'foraDominio'
  return null
}

// ---------------------------------------------------------------------------
// Catálogos derivados dos cards em memória
// ---------------------------------------------------------------------------

export interface Catalogos {
  equipes: string[]
  pessoas: string[]
  setores: string[]
  ufs: string[]
  projetos: string[]
}

function uniq(valores: Array<string | null | undefined>): string[] {
  const set = new Set<string>()
  for (const v of valores) {
    if (v != null && v !== '') set.add(v)
  }
  return Array.from(set)
}

export function catalogos(cards: Tarefa[]): Catalogos {
  return {
    equipes: uniq(cards.map((c) => c.equipeAtendimento)),
    // `nomeDePessoaOuNulo` tira os rótulos de ausência ("Responsável
    // Indefinido"): no catálogo eles viravam entidade `pessoa` resolvível, e
    // qualquer pergunta sobre pessoas podia casar com um balde de nulos.
    pessoas: uniq([
      ...cards.map((c) => nomeDePessoaOuNulo(c.responsavelAtendimentoNome)),
      ...cards.map((c) => nomeDePessoaOuNulo(c.responsavelNome)),
      ...cards.map((c) => nomeDePessoaOuNulo(c.fechadoPorNome)),
    ]),
    setores: uniq(cards.flatMap((c) => c.fechadoPorDepartamentos)),
    ufs: uniq(cards.map((c) => c.estadoUf)),
    projetos: uniq(cards.map((c) => c.projetoNome)),
  }
}

// ---------------------------------------------------------------------------
// Mapa nome de estado -> sigla (para reconhecer "Rio de Janeiro" -> RJ)
// ---------------------------------------------------------------------------

const NOME_UF_PARA_SIGLA: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  minas: 'MG',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
}

// ---------------------------------------------------------------------------
// Fuzzy-match de nome contra um catálogo
// ---------------------------------------------------------------------------

interface ResultadoMatch {
  valorCanonico: string
  confianca: number
}

/**
 * Casa um trecho do texto contra os valores do catálogo por:
 * (a) igualdade normalizada, (b) includes bidirecional (primeiro/último nome),
 * (c) Levenshtein proporcional ao tamanho (typos).
 * Retorna o melhor match acima de um limiar mínimo, ou null.
 */
function matchNoCatalogo(txt: string, valores: string[]): ResultadoMatch | null {
  let melhor: ResultadoMatch | null = null

  for (const valor of valores) {
    const alvo = normalizar(valor)
    if (!alvo) continue

    // (a) igualdade / substring direta do valor inteiro no texto.
    if (txt.includes(alvo)) {
      const conf = 1
      if (!melhor || conf > melhor.confianca) melhor = { valorCanonico: valor, confianca: conf }
      continue
    }

    // (b) match por tokens (primeiro/último nome). Ex.: "cinthia" -> "Cinthia Filgueiras".
    const tokensAlvo = alvo.split(' ').filter((t) => t.length >= 3)
    const tokensTxt = txt.split(' ').filter((t) => t.length >= 3)
    let tokensCasados = 0
    let tokensFuzzy = 0
    for (const ta of tokensAlvo) {
      const casouExato = tokensTxt.some((tt) => tt === ta)
      if (casouExato) {
        tokensCasados += 1
        continue
      }
      // typo em um token: Levenshtein pequeno relativo ao tamanho.
      //
      // Distância 2 SÓ em token longo (8+). Antes o teto era 2 a partir de 5
      // caracteres, e duas edições em cinco letras são 40% da palavra — o
      // suficiente para "grupo" casar com "bruno" (g→b, p→n). Em produção isso
      // fez "as últimas tarefas do grupo 86" responder "Há 287 tarefas de Bruno
      // Borges": um nome de pessoa inventado a partir de uma palavra comum.
      //
      // Os typos reais que precisamos tolerar são todos de UMA edição
      // ("cintia"→"cinthia", "simoni"→"simone", "freytas"→"freitas") ou vêm de
      // pontuação colada ("cinthia?"→"cinthia", 8 caracteres), então este teto
      // não custa nenhum acerto legítimo.
      const casouFuzzy = tokensTxt.some((tt) => {
        const limiar = tt.length >= 8 ? 2 : 1
        return levenshtein(tt, ta) <= limiar
      })
      if (casouFuzzy) tokensFuzzy += 1
    }
    if (tokensCasados > 0 || tokensFuzzy > 0) {
      const denom = Math.max(tokensAlvo.length, 1)
      const proporcao = (tokensCasados + tokensFuzzy) / denom
      // Um token exato do nome (ex.: primeiro nome "Cinthia") já é um sinal
      // forte; começamos em 0.6 e subimos com a cobertura e com quantos tokens
      // casaram exatamente. Matches só-fuzzy ficam abaixo, mas ainda acima do
      // limiar quando cobrem o nome inteiro.
      const base = tokensCasados > 0 ? 0.6 : 0.45
      const conf = base + 0.3 * proporcao + 0.05 * (tokensCasados / denom)
      if (conf >= 0.5 && (!melhor || conf > melhor.confianca)) {
        melhor = { valorCanonico: valor, confianca: Math.min(conf, 0.95) }
      }
    }
  }

  return melhor
}

// ---------------------------------------------------------------------------
// Resolução de entidade
// ---------------------------------------------------------------------------

const EQUIPES_CONHECIDAS = EQUIPES_ATENDIMENTO as readonly string[]

function mencionaPalavra(txt: string, palavras: RegExp): boolean {
  return palavras.test(txt)
}

/**
 * Resolve até duas entidades a partir do texto. A primeira é a entidade
 * principal; a segunda só é preenchida em comparações ("Cinthia vs Simone").
 *
 * Ordem de tentativa: UF, projeto, equipe/pessoa, setor. Se uma palavra de
 * tipo ("equipe", "setor", "estado") aparece mas nenhum valor casa, retorna a
 * entidade com valorCanonico=null (sinal de "qual?").
 */
export function resolverEntidade(
  txt: string,
  cat: Catalogos,
): { entidade: Entidade; segunda: Entidade | null } {
  const mencionaEquipe = mencionaPalavra(txt, /\bequipe\b|\btime\b/)
  const mencionaSetor = mencionaPalavra(txt, /\bsetor\b|\bdepartamento\b|\bdepto\b/)
  const mencionaEstado = mencionaPalavra(txt, /\bestado\b|\buf\b/)
  const mencionaProjeto = mencionaPalavra(txt, /\bprojeto\b/)

  // --- UF ---
  const ufMatch = resolverUf(txt, cat.ufs)
  if (ufMatch) {
    return {
      entidade: {
        tipo: 'uf',
        valorCanonico: ufMatch,
        valorBruto: ufMatch,
        todas: false,
        confiancaMatch: 1,
      },
      segunda: null,
    }
  }

  // --- Projeto (só se a palavra "projeto" aparecer, para não confundir com nomes) ---
  if (mencionaProjeto) {
    const proj = matchNoCatalogo(txt, cat.projetos)
    return {
      entidade: {
        tipo: 'projeto',
        valorCanonico: proj?.valorCanonico ?? null,
        valorBruto: proj?.valorCanonico ?? null,
        todas: false,
        confiancaMatch: proj?.confianca ?? 0,
      },
      segunda: null,
    }
  }

  // --- Setor (departamento) ---
  const setorMatch = matchNoCatalogo(txt, cat.setores)
  if (mencionaSetor || (setorMatch && setorMatch.confianca >= 0.9 && !mencionaEquipe)) {
    return {
      entidade: {
        tipo: 'setor',
        valorCanonico: setorMatch?.valorCanonico ?? null,
        valorBruto: setorMatch?.valorCanonico ?? null,
        todas: false,
        confiancaMatch: setorMatch?.confianca ?? 0,
      },
      segunda: null,
    }
  }

  // --- Equipe / pessoa ---
  // Procurar TODOS os nomes de equipe presentes (para comparação).
  const equipesEncontradas = encontrarTodos(txt, EQUIPES_CONHECIDAS)
  if (equipesEncontradas.length >= 1) {
    const [primeira, segunda] = equipesEncontradas
    return {
      entidade: {
        tipo: 'equipe',
        valorCanonico: primeira.valorCanonico,
        valorBruto: primeira.valorCanonico,
        todas: false,
        confiancaMatch: primeira.confianca,
      },
      segunda: segunda
        ? {
            tipo: 'equipe',
            valorCanonico: segunda.valorCanonico,
            valorBruto: segunda.valorCanonico,
            todas: false,
            confiancaMatch: segunda.confianca,
          }
        : null,
    }
  }

  // "equipe indefinida" é uma entidade legítima.
  if (mencionaEquipe && /indefinid/.test(txt) && cat.equipes.includes('indefinido')) {
    return {
      entidade: {
        tipo: 'equipe',
        valorCanonico: 'indefinido',
        valorBruto: 'indefinido',
        todas: false,
        confiancaMatch: 1,
      },
      segunda: null,
    }
  }

  // Pessoa (fora das 4 supervisoras): match no catálogo de pessoas.
  // Só quando o usuário NÃO nomeou explicitamente outro eixo (equipe/estado):
  // nesses casos um match difuso de pessoa (ex.: "melhor"~"Melo",
  // "ultima"~"Lima") é ruído, e o eixo nomeado deve prevalecer — do contrário
  // "qual equipe teve melhor rendimento" cairia num ranking por pessoa.
  const nomeouOutroEixo = mencionaEquipe || mencionaEstado
  const pessoasEncontradas = nomeouOutroEixo ? [] : encontrarTodos(txt, cat.pessoas)
  // Excluir pessoas que são exatamente nomes de equipe (já tratadas acima).
  const pessoasFiltradas = pessoasEncontradas.filter(
    (p) => !EQUIPES_CONHECIDAS.some((eq) => normalizar(eq) === normalizar(p.valorCanonico)),
  )
  if (pessoasFiltradas.length >= 1) {
    const [primeira, segunda] = pessoasFiltradas
    return {
      entidade: {
        tipo: 'pessoa',
        valorCanonico: primeira.valorCanonico,
        valorBruto: primeira.valorCanonico,
        todas: false,
        confiancaMatch: primeira.confianca,
      },
      segunda: segunda
        ? {
            tipo: 'pessoa',
            valorCanonico: segunda.valorCanonico,
            valorBruto: segunda.valorCanonico,
            todas: false,
            confiancaMatch: segunda.confianca,
          }
        : null,
    }
  }

  // Palavra de tipo presente sem valor casável -> "qual?".
  if (mencionaEquipe) {
    return {
      entidade: {
        tipo: 'equipe',
        valorCanonico: null,
        valorBruto: null,
        todas: false,
        confiancaMatch: 0,
      },
      segunda: null,
    }
  }
  if (mencionaEstado) {
    return {
      entidade: {
        tipo: 'uf',
        valorCanonico: null,
        valorBruto: null,
        todas: false,
        confiancaMatch: 0,
      },
      segunda: null,
    }
  }

  return { entidade: entidadeVazia(), segunda: null }
}

/** Encontra todos os valores do catálogo presentes no texto, ordenados por confiança. */
function encontrarTodos(txt: string, valores: readonly string[]): ResultadoMatch[] {
  const encontrados: ResultadoMatch[] = []
  for (const valor of valores) {
    const m = matchNoCatalogo(txt, [valor])
    if (m) encontrados.push(m)
  }
  return encontrados.sort((a, b) => b.confianca - a.confianca)
}

/** Resolve UF por sigla direta (2 letras isoladas) ou por nome do estado. */
function resolverUf(txt: string, ufsPresentes: string[]): string | null {
  // nome do estado (mais longos primeiro, para "rio grande do sul" antes de "rio de janeiro").
  // Word-boundary para não casar "para" dentro de "compara".
  const nomes = Object.keys(NOME_UF_PARA_SIGLA).sort((a, b) => b.length - a.length)
  for (const nome of nomes) {
    const re = new RegExp(`(^|\\s)${nome}(\\s|\\?|!|\\.|,|$)`)
    if (re.test(txt)) return NOME_UF_PARA_SIGLA[nome]
  }
  // sigla direta: 2 letras isoladas que existem no catálogo de UFs presentes.
  for (const uf of ufsPresentes) {
    const sigla = normalizar(uf)
    const re = new RegExp(`(^|\\s)${sigla}(\\s|\\?|!|\\.|,|$)`, 'i')
    if (re.test(txt)) return uf
  }
  return null
}

// ---------------------------------------------------------------------------
// Detecção de follow-up
// ---------------------------------------------------------------------------

/**
 * Uma pergunta é follow-up quando é curta e começa com "e ", ou usa um pronome
 * sem entidade explícita ("dela", "dele", "esse", "isso", "outra"), ou não
 * carrega métrica própria mas há intenção anterior disponível.
 */
export function pareceFollowUp(txt: string): boolean {
  if (/^e\b/.test(txt)) return true
  if (
    /\bdela\b|\bdele\b|\besse\b|\bessa\b|\bisso\b|\boutra\b|\boutro\b|\bmesmo\b|desse numero|esse numero/.test(
      txt,
    )
  )
    return true
  if (/^(por que|porque|detalha|compara|qual foi melhor|qual foi pior)/.test(txt)) return true
  return false
}

// ---------------------------------------------------------------------------
// Extração completa da intenção (sem herança de contexto)
// ---------------------------------------------------------------------------

export function extrairIntencao(pergunta: string, cards: Tarefa[], agora: Date): Intencao {
  const textoNormalizado = normalizar(pergunta)
  const cat = catalogos(cards)

  const foraDeEscopo = detectarForaDeEscopo(textoNormalizado)
  const periodo = extrairPeriodo(textoNormalizado, agora)
  const agrupamento = extrairAgrupamento(textoNormalizado)
  const metrica = extrairMetrica(textoNormalizado, periodo.tipo !== 'nenhum')
  const { entidade, segunda } = resolverEntidade(textoNormalizado, cat)

  // Ranking/tendência/porEquipe marcam a entidade como "todas" quando não há
  // valor específico — "quantas cada equipe fechou" não está perguntando "qual
  // equipe?", já está pedindo a quebra por todas elas.
  if (
    (agrupamento === 'ranking' || agrupamento === 'tendencia' || metrica === 'porEquipe') &&
    entidade.valorCanonico === null
  ) {
    entidade.todas = true
    // O eixo NOMEADO no texto ("qual EQUIPE...", "qual SETOR...") define a
    // dimensão do ranking e VENCE qualquer palpite do resolvedor de entidade
    // (que, sem um nome específico casado, pode ter chutado 'pessoa'). Só se o
    // texto não nomear eixo algum é que mantemos o que veio antes.
    const eixoExplicito = inferirTipoEntidadeDoTexto(textoNormalizado)
    if (eixoExplicito !== 'nenhuma') {
      entidade.tipo = eixoExplicito
    }
  }

  return {
    metrica,
    entidade,
    entidadeSecundaria: segunda,
    periodo,
    agrupamento,
    foraDeEscopo,
    textoNormalizado,
    suposicoes: [],
  }
}

function inferirTipoEntidadeDoTexto(txt: string): TipoEntidade {
  if (/\bequipe\b|\btime\b/.test(txt)) return 'equipe'
  if (/\bsetor\b|\bdepartamento\b/.test(txt)) return 'setor'
  if (/\bestado\b|\buf\b/.test(txt)) return 'uf'
  if (/\bprojeto\b/.test(txt)) return 'projeto'
  if (/\bpessoa\b|\bcolaborador\b|\bresponsavel\b/.test(txt)) return 'pessoa'
  return 'nenhuma'
}

// ---------------------------------------------------------------------------
// Mesclagem com contexto (follow-up)
// ---------------------------------------------------------------------------

/**
 * Herda dimensões não mencionadas da intenção anterior. As dimensões presentes
 * na nova pergunta sobrescrevem; as ausentes são herdadas.
 */
export function mesclarComContexto(atual: Intencao, anterior: Intencao | null): Intencao {
  if (!anterior) return atual

  const ehFollowUp = pareceFollowUp(atual.textoNormalizado)
  if (!ehFollowUp) return atual

  const mesclada: Intencao = { ...atual, suposicoes: [...atual.suposicoes] }

  // Métrica: herdar se a nova não trouxe métrica útil (desconhecida/total sem sinal).
  const novaMetricaFraca =
    atual.metrica === 'desconhecida' ||
    (atual.metrica === 'total' && !/\btotal\b|quantas|quantos|volume/.test(atual.textoNormalizado))
  // "por que" / "detalha" trocam a métrica intencionalmente — não herdar por cima.
  const metricaExplicita = atual.metrica === 'explicacao' || atual.metrica === 'detalhe'
  if (novaMetricaFraca && !metricaExplicita) {
    mesclada.metrica = anterior.metrica
  }

  // Entidade: se a nova não identificou nenhuma entidade concreta, herdar.
  if (atual.entidade.tipo === 'nenhuma' || atual.entidade.valorCanonico === null) {
    if (!atual.entidade.todas) {
      // Exceção: "compara com a outra equipe" usa a entidade secundária anterior.
      if (/outra|outro/.test(atual.textoNormalizado) && anterior.entidadeSecundaria) {
        mesclada.entidade = anterior.entidadeSecundaria
        mesclada.entidadeSecundaria = anterior.entidade
      } else {
        mesclada.entidade = anterior.entidade
        mesclada.entidadeSecundaria = anterior.entidadeSecundaria
      }
    }
  }

  // Período: herdar se a nova não trouxe período.
  if (atual.periodo.tipo === 'nenhum') {
    mesclada.periodo = anterior.periodo
  }

  // Agrupamento: herdar se a nova não trouxe agrupamento.
  if (atual.agrupamento === 'nenhum' && !metricaExplicita) {
    mesclada.agrupamento = anterior.agrupamento
  }

  return mesclada
}
