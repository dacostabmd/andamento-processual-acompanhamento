// Códigos de status reais do Bitrix24 (REAL_STATUS em tasks.task.list). Não existe
// um "1 = não encontrado" na API — isso só fazia sentido no sistema antigo, que
// mantinha uma cópia local que podia ficar desatualizada. Aqui os dados vêm sempre
// ao vivo do Bitrix, então uma tarefa que não existe mais simplesmente não aparece.
export type StatusTarefa = 2 | 3 | 4 | 5 | 6

export const STATUS_LABELS: Record<StatusTarefa, string> = {
  2: 'Aguardando a execução',
  3: 'Em andamento',
  4: 'Aguardando controle',
  5: 'Concluído',
  6: 'Adiado',
}

export const STATUS_CONCLUIDO: StatusTarefa = 5

// PRIORITY em tasks.task.list vem como string numérica: '0' baixa, '1' normal, '2' alta.
export type PrioridadeTarefa = '0' | '1' | '2'

export const PRIORIDADE_LABELS: Record<PrioridadeTarefa, string> = {
  '0': 'Baixa',
  '1': 'Normal',
  '2': 'Alta',
}

/** Não há mais banco local — o id de cada entidade é o próprio id no Bitrix24. */
export interface Departamento {
  id: number
  nome: string
}

export interface Colaborador {
  id: number
  nome: string
  ativo: boolean
}

export interface Projeto {
  id: number
  nome: string
}

export interface Tarefa {
  id: number
  titulo: string
  prazoFinal: string | null
  status: StatusTarefa
  finalizadoEm: string | null
  projetoId: number | null
  projetoNome: string | null
  fechadoPorId: number | null
  fechadoPorNome: string | null
  /** Um colaborador pode pertencer a mais de um departamento (N:N). */
  fechadoPorDepartamentos: string[]
  /** Responsável atual pela tarefa (RESPONSIBLE_ID), distinto de quem a fechou. */
  responsavelId: number | null
  responsavelNome: string | null
  prioridade: PrioridadeTarefa
  /**
   * Responsável pelo atendimento do cliente — é o único participante
   * (accomplice) da tarefa, distinto do responsável nativo. Critério de
   * agrupamento da tela de inteligência. Sem participante → "Indefinido".
   */
  responsavelAtendimentoId: number | null
  responsavelAtendimentoNome: string | null
  /** Equipe (departamento) do responsável pelo atendimento, ou "indefinido". */
  equipeAtendimento: EquipeAtendimento
  /** UF (sigla de 2 letras) do processo, normalizada do campo nativo da tarefa. */
  estadoUf: string | null
}

/**
  Equipes de atendimento reconhecidas — cada uma é o departamento (pelo ID no
 * Bitrix24) da respectiva superiora. Um responsável cujo departamento não bate
 * com nenhum ID cai em "indefinido".
 */
export const EQUIPES_ATENDIMENTO = [
  'Cinthia Filgueiras',
  'Simone Freitas',
  'Quézia Karen',
  'Lorena Pontes',
] as const

export type EquipeAtendimento = (typeof EQUIPES_ATENDIMENTO)[number] | 'indefinido'

/**
 * ID do departamento (Bitrix24) de cada equipe de atendimento — espelha
 * DEPARTAMENTO_ID_POR_EQUIPE no worker (app/config.py). IDs confirmados ao vivo
 * via department.get (os antigos 782/784/862/864 não eram departamentos válidos).
 */
export const DEPARTAMENTO_ID_POR_EQUIPE: Record<(typeof EQUIPES_ATENDIMENTO)[number], number> = {
  'Cinthia Filgueiras': 1250,
  'Simone Freitas': 1252,
  'Quézia Karen': 1418,
  'Lorena Pontes': 1416,
}

/**
 * Nomes (não IDs) dos 4 departamentos das equipes, confirmados ao vivo via
 * department.get — usados para checar `fechadoPorDepartamentos` (que o worker
 * grava como nome, não ID). Ex.: Victoria Persi fecha tarefas nos grupos
 * monitorados mas não pertence a nenhum destes departamentos — o checkbox
 * "ocultar fora das equipes" usa esta lista para filtrá-la fora do "Fechado por".
 */
export const NOMES_DEPARTAMENTO_EQUIPES = [
  'Andamento Cinthia Filgueiras',
  'Andamento Simone Freitas',
  'Andamento Quézia Karen',
  'Andamento Lorena Pontes',
] as const

/**
 * Nome do departamento ("Andamento Simone Freitas") → equipe ("Simone Freitas").
 * É o caminho inverso de NOMES_DEPARTAMENTO_EQUIPES e existe porque o snapshot
 * grava `fechadoPorDepartamentos` como NOME, não como ID — é a única forma de
 * saber a equipe de quem efetivamente fechou a tarefa.
 */
export const EQUIPE_POR_NOME_DEPARTAMENTO: Record<string, EquipeAtendimento> = {
  'Andamento Cinthia Filgueiras': 'Cinthia Filgueiras',
  'Andamento Simone Freitas': 'Simone Freitas',
  'Andamento Quézia Karen': 'Quézia Karen',
  'Andamento Lorena Pontes': 'Lorena Pontes',
}

/**
 * Dimensão pela qual o dashboard agrupa os cards. As duas visões respondem a
 * perguntas diferentes e podem divergir na MESMA tarefa:
 *
 *   - 'atendimento': agrupa pelo participante da tarefa (accomplices[0]). É quem
 *     responde ao cliente. Cobre 100% dos cards, mas a ordem do array de
 *     participantes no Bitrix não é semântica, então o valor é frágil — hoje 93%
 *     dos cards caem numa única pessoa.
 *   - 'executora': agrupa por quem FECHOU o card, usando o departamento real do
 *     fechador (`fechadoPorDepartamentos`). É a atribuição confiável de trabalho
 *     entregue, mas só existe para cards já fechados.
 *
 * Exemplo real do snapshot: um card com fechadoPorDepartamentos =
 * ["Andamento Simone Freitas"] aparece como equipe "Cinthia Filgueiras" na visão
 * de atendimento (porque Cinthia é o accomplice) e como "Simone Freitas" na
 * visão executora. Ver docs/ia-modelagem-e-hierarquia.md §1.
 */
export type VisaoDashboard = 'atendimento' | 'executora'

export const VISOES_DASHBOARD: Array<{
  valor: VisaoDashboard
  rotulo: string
  descricao: string
}> = [
  {
    valor: 'atendimento',
    rotulo: 'Por atendimento',
    descricao: 'Agrupa pelo responsável pelo atendimento (participante do card)',
  },
  {
    valor: 'executora',
    rotulo: 'Por equipe executora',
    descricao: 'Agrupa por quem fechou o card, pelo departamento real do fechador',
  },
]

/**
 * "Pacote" da tela de inteligência: todos os cards atribuídos a uma mesma
 * pessoa, já classificados na equipe dela. Quem é essa pessoa depende da
 * VisaoDashboard ativa — o responsável pelo atendimento na visão 'atendimento',
 * ou quem fechou o card na visão 'executora'. Os nomes dos campos preservam a
 * nomenclatura original para não quebrar os gráficos, que consomem as duas
 * visões pelo mesmo formato.
 */
export interface PacoteAtendimento {
  responsavelAtendimentoId: number | null
  responsavelAtendimentoNome: string
  equipe: EquipeAtendimento
  cards: Tarefa[]
}

/** Contagem de cards por situação de prazo, base dos gráficos empilhados. */
export interface ContagemSituacao {
  total: number
  noPrazo: number
  atrasadas: number
  concluidas: number
  adiadas: number
}

/** Métricas de uma equipe para os gráficos de inteligência. */
export interface InteligenciaEquipe {
  equipe: EquipeAtendimento
  contagem: ContagemSituacao
  responsaveis: number
}

/** Volume de cards de um responsável (para o ranking por responsável). */
export interface VolumeResponsavel {
  responsavelAtendimentoId: number | null
  nome: string
  equipe: EquipeAtendimento
  total: number
}

/** Volume de cards por "fechado por" (campo customizado), para o gráfico próprio. */
export interface VolumeFechadoPor {
  fechadoPorId: number | null
  nome: string
  total: number
}

/**
 * Uma linha do ranking de quem fecha tarefas (campo `closedBy` do Bitrix).
 *
 * Diferente de VolumeFechadoPor, que só carrega o total para o gráfico de
 * barras: aqui interessa comparar pessoas entre si, então cada linha traz a
 * equipe (para saber de quem é o time), a repartição por prazo (volume alto com
 * muito atraso não é a mesma coisa que volume alto no prazo) e a participação
 * no total.
 */
export interface RankingFechador {
  fechadoPorId: number
  nome: string
  /** Equipe do fechador, derivada dos departamentos dele. */
  equipe: EquipeAtendimento
  /** Cards concluídos por esta pessoa. */
  total: number
  /** Dos concluídos, quantos terminaram até o prazo. */
  noPrazo: number
  /** Dos concluídos, quantos terminaram depois do prazo. */
  comAtraso: number
  /** Concluídos sem prazo definido — não entram em noPrazo nem comAtraso. */
  semPrazo: number
  /** Participação percentual no total de cards fechados do recorte atual. */
  percentual: number
}

/**
 * Ranking completo + os totais que dão contexto a ele. Os totais evitam a
 * leitura errada mais comum: tratar o volume de fechamento como se cobrisse
 * todos os cards, quando só cards CONCLUÍDOS têm fechador.
 */
export interface RankingFechadores {
  linhas: RankingFechador[]
  /** Cards concluídos com fechador identificado — a base do ranking. */
  totalFechado: number
  /** Concluídos sem `closedBy` preenchido: ficam fora do ranking. */
  concluidasSemFechador: number
  /** Cards ainda não concluídos: não têm fechador por definição. */
  naoConcluidas: number
}

/** Volume de cards por UF (estado), para o ranking geográfico. */
export interface VolumePorUf {
  uf: string
  total: number
}

/**
 * Contagem de cards por faixa de urgência (dias até o vencimento). Cards já
 * concluídos ou adiados não entram em nenhuma faixa — só quem ainda pode
 * vencer/atrasar é urgência. "vencidas" cobre quem já passou do prazo.
 */
export interface FaixasUrgencia {
  vencidas: number
  ateTresDias: number
  quatroASeteDias: number
  oitoAQuinzeDias: number
  maisDeQuinzeDias: number
}

/**
 * Um ponto da série mensal (por mês de prazoFinal): total concluído, e — das
 * concluídas — a % que terminou depois do prazo (finalizadoEm > prazoFinal).
 * É pontualidade histórica de entrega, não urgência atual (não depende de
 * "agora": um mês fechado no passado não satura em 100%).
 */
export interface PontoTendenciaMensal {
  /** Chave "AAAA-MM" (ordenável como string). */
  mes: string
  /** Rótulo curto para o eixo (ex.: "jan/26"). */
  label: string
  concluidas: number
  taxaAtraso: number
}

/**
 * Modelo de dados consolidado que alimenta os gráficos da tela de inteligência.
 * Derivado dos pacotes já filtrados — recalculado a cada mudança de filtro.
 */
export interface InteligenciaDados {
  porEquipe: InteligenciaEquipe[]
  topResponsaveis: VolumeResponsavel[]
  topFechadoPor: VolumeFechadoPor[]
  porUf: VolumePorUf[]
  urgencia: FaixasUrgencia
  tendenciaMensal: PontoTendenciaMensal[]
  totalCards: number
}

/**
 * Resultado da validação dos nomes informados contra os departamentos do Bitrix
 * — o que a api_url busca para "trackear a modelagem de dados". Cada equipe pode
 * ou não existir como departamento na fonte real.
 */
export interface EquipeResolvida {
  nome: EquipeAtendimento
  departamentoId: number | null
  encontrada: boolean
}

export interface SessaoUsuario {
  colaborador: Colaborador
  projetosPermitidos: Projeto[]
}

export type FiltroStatus = 'todos' | 'concluido' | 'atrasado' | 'no_prazo'
export type FiltroPrazo = 'todas' | 'com_prazo' | 'sem_prazo'

/**
 * dataInicio/dataFim usam o mesmo formato de string (YYYY-MM-DD) que o
 * DatePickerInput do Mantine v9 retorna em `onChange`, evitando conversões.
 */
export interface FiltrosDashboard {
  dataInicio: string | null
  dataFim: string | null
  status: FiltroStatus
  filtroPrazo: FiltroPrazo
  setor: string | null
  projetoId: number | null
  fechadoPorId: number | null
  responsavelId: number | null
  prioridade: PrioridadeTarefa | null
  /** UF (sigla) selecionada, ou null para todas. */
  estado: string | null
  ocultarIndefinidos: boolean
  ocultarForaDasEquipes: boolean
  /** Modo de cálculo da taxa de atraso: 'ativas' (divisão pelas pendentes) ou 'total' (divisão pelo volume total). */
  modoTaxaAtraso: 'ativas' | 'total'
}

/** Janela padrão de busca: evita baixar o histórico inteiro (grupos monitorados somam centenas de milhares de tarefas). */
export const JANELA_PADRAO_DIAS = 90

/** Filtros vazios sem restrição inicial de data por padrão. */
export function filtrosVazios(_agora?: Date): FiltrosDashboard {

  return {
    dataInicio: null,
    dataFim: null,
    status: 'todos',
    filtroPrazo: 'todas',
    setor: null,
    projetoId: null,
    fechadoPorId: null,
    responsavelId: null,
    prioridade: null,
    estado: null,
    ocultarIndefinidos: false,
    ocultarForaDasEquipes: false,
    modoTaxaAtraso: 'ativas',
  }
}



export interface MetricasTarefas {
  total: number
  concluidas: number
  atrasadas: number
  eficiencia: number
  vencemEmBreve: number
  aguardandoRevisao: number
  emAndamento: number
  taxaAtraso: number
}

export interface MetricasPorSetor {
  setor: string
  metricas: MetricasTarefas
}

export interface MetricasPorEquipe {
  equipe: EquipeAtendimento
  metricas: MetricasTarefas
}
