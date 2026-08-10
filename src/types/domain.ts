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
   * Responsável nativo da tarefa (RESPONSIBLE_ID) — quem atende o card.
   * Null quando a tarefa não tem responsável identificável.
   */
  responsavelAtendimentoId: number | null
  responsavelAtendimentoNome: string | null
  /**
   * Equipe de atendimento: uma das 4 equipes (Simone Freitas, Quézia Karen,
   * Cinthia Filgueiras, Lorena Pontes) do SUPERVISOR (UF_HEAD) de quem fechou
   * a tarefa, com fallback para a equipe do supervisor do responsável pelo
   * atendimento quando o supervisor do fechador não pertence a nenhuma das 4.
   * Nunca vem do participante (accomplices) da tarefa.
   */
  equipeAtendimento: EquipeAtendimento
  /**
   * De onde saiu `equipeAtendimento`. 'fechador' = veio do supervisor de quem
   * fechou a tarefa (caso normal); 'responsavel' = veio do supervisor do
   * responsável pelo atendimento (fallback, usado quando o supervisor do
   * fechador não pertence a nenhuma das 4 equipes); 'nao_atribuida' = nenhum
   * dos dois supervisores pertence a uma equipe (ou nenhum é identificável).
   * 'participante' é valor legado de snapshots gravados antes desta versão.
   */
  origemEquipeAtendimento: OrigemEquipe
  /** Equipe de quem FECHOU o card, pelo ID do departamento do fechador. */
  equipeFechador: EquipeAtendimento
  /** UF (sigla de 2 letras) do processo, normalizada do campo nativo da tarefa. */
  estadoUf: string | null

  /**
   * Setor e supervisor de cada papel, vindos do cadastro da pessoa no Bitrix.
   * `setor*` é o nome do departamento (UF_DEPARTMENT), preenchido em 100% dos
   * fechadores. `supervisor*` é o campo "Supervisor" da ficha do usuário — que
   * no Bitrix é o chefe (UF_HEAD) do departamento —, preenchido em ~61%.
   */
  setorFechador: string | null
  gestorFechadorId: number | null
  gestorFechadorNome: string | null
  setorAtendimento: string | null
  gestorAtendimentoId: number | null
  gestorAtendimentoNome: string | null
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
 * Procedência da equipe de atendimento. 'fechador' = supervisor de quem fechou
 * a tarefa (caso normal); 'responsavel' = supervisor do responsável pelo
 * atendimento (fallback quando o supervisor do fechador não tem equipe).
 * 'participante' é valor legado de snapshots gravados antes desta versão.
 * Espelha `origemEquipeAtendimento` em types.ts no worker.
 */
export type OrigemEquipe = 'participante' | 'responsavel' | 'fechador' | 'nao_atribuida'

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
 *   - 'atendimento': agrupa pelo RESPONSÁVEL da tarefa, na equipe do departamento
 *     dele. Cobre também cards ainda abertos, que é o que a visão executora não
 *     consegue ver.
 *   - 'executora': agrupa por quem FECHOU o card, na equipe do departamento do
 *     fechador. É a atribuição de trabalho entregue, mas só existe para cards já
 *     fechados.
 *
 * As duas podem divergir no MESMO card, e isso não é erro: quem atende nem sempre
 * é quem fecha. Ver docs/ia-modelagem-e-hierarquia.md §1.
 */
export type VisaoDashboard = 'atendimento' | 'executora'

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
  /** Departamento do fechador, direto do cadastro (mais específico que a equipe). */
  setor: string | null
  /** "Supervisor" da ficha do Bitrix — o chefe do departamento. Null se não cadastrado. */
  supervisor: string | null
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
  /** Pessoas do ranking sem supervisor cadastrado no Bitrix. */
  pessoasSemSupervisor: number
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
    ocultarIndefinidos: true,
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
  /**
   * Denominador usado no cálculo de `taxaAtraso` (tarefas ativas ou total,
   * conforme `modoTaxaAtraso`). Exposto para a UI mostrar "1 de 1" ao lado da
   * porcentagem — sem isso, uma taxa de 100% sobre uma base de 1 tarefa (comum
   * em recortes pequenos, como uma equipe só) parece um erro de cálculo.
   */
  baseTaxaAtraso: number
}

export interface MetricasPorSetor {
  setor: string
  metricas: MetricasTarefas
}

export interface MetricasPorEquipe {
  equipe: EquipeAtendimento
  metricas: MetricasTarefas
}
