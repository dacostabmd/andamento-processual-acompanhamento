/**
 * Memória de Equipes e Colaboradores para o Assistente de IA / LangChain
 *
 * Mapeamento canônico das 4 equipes de atendimento do Andamento Processual,
 * supervisores e seus respectivos colaboradores atualizados.
 */

export interface EquipeMemoria {
  equipe: string
  departamentoBitrix: string
  supervisor: string
  totalColaboradores: number
  membros: string[]
  observacoes?: string
}

export const MEMORIA_EQUIPES: EquipeMemoria[] = [
  {
    equipe: 'Simone Freitas',
    departamentoBitrix: 'Andamento Simone Freitas',
    supervisor: 'Simone Freitas (Coordenadora de Atendimento)',
    totalColaboradores: 17,
    membros: [
      'Fabio Moreira',
      'Pablo Nacif',
      'Acsa Faria',
      'Júlia Guimarães',
      'Anna Ferreira',
      'Rayane Fernandes',
      'Ariane Souza',
      'Emilly Victoria',
      'Paula Gomes',
      'Ricardo Soares',
      'Monalisa Ferreira',
      'Rose Brandão',
      'Lucas Leonço',
      'Victor Pires',
      'Izabela Ribeiro',
      'Maria Passos',
      'Bruna Avelar',
    ],
    observacoes:
      'Priscilla Abreu não pertence a esta equipe. Adicionados: Victor Pires, Izabela Ribeiro, Maria Passos, Bruna Avelar.',
  },
  {
    equipe: 'Cinthia Filgueiras',
    departamentoBitrix: 'Andamento Cinthia Filgueiras',
    supervisor: 'Cinthia Filgueiras',
    totalColaboradores: 20,
    membros: [
      'Lucas Magalhaes',
      'Debora Corrêa',
      'Beatriz Frazao',
      'Stephani Silva',
      'Rômulo Sally',
      'Isadora Ferraz',
      'Gabriela Nunes',
      'Nicole Kleiz',
      'Isabella Andrade',
      'Gabriel Buentes',
      'Jonathan Weber',
      'Juliana Silva',
      'Gabryella Soares',
      'Elizabeth Nogueira',
      'Jessica Silva',
      'Camila Chaves',
      'Cassiane Lucas',
      'Graziela Loureiro',
      'Vagner Rodrigues',
      'Luiza Blanc',
    ],
  },
  {
    equipe: 'Quézia Karen',
    departamentoBitrix: 'Andamento Quézia Karen',
    supervisor: 'Quézia Karen',
    totalColaboradores: 7,
    membros: [
      'Nathalia Lima',
      'Wellington Ramos',
      'Isabelly Antunes',
      'Ana Carolina Lopes',
      'Ricardo - andamento processual',
      'Vitor Pereira',
      'Bruno Pimentel',
    ],
  },
  {
    equipe: 'Lorena Pontes',
    departamentoBitrix: 'Andamento Lorena Pontes',
    supervisor: 'Lorena Pontes',
    totalColaboradores: 6,
    membros: [
      'Juliana Silva',
      'Gabryella Soares',
      'Anderson Gregorio',
      'Jessica Fernanda Soares',
      'Nailson J.S.O',
      'Tiago Anjos',
    ],
  },
]

export const PROMPT_MEMORIA_LANGCHAIN = `
CONTEXTO DE EQUIPES E GOVERNANÇA (Andamento Processual):

- Simone Freitas (Supervisora): Fabio Moreira, Pablo Nacif, Acsa Faria, Júlia Guimarães, Anna Ferreira, Rayane Fernandes, Ariane Souza, Emilly Victoria, Paula Gomes, Ricardo Soares, Monalisa Ferreira, Rose Brandão, Lucas Leonço, Victor Pires, Izabela Ribeiro, Maria Passos, Bruna Avelar. (Obs: Priscilla Abreu NÃO pertence a esta equipe).
- Cinthia Filgueiras (Supervisora): Lucas Magalhaes, Debora Corrêa, Beatriz Frazao, Stephani Silva, Rômulo Sally, Isadora Ferraz, Gabriela Nunes, Nicole Kleiz, Isabella Andrade, Gabriel Buentes, Jonathan Weber, Juliana Silva, Gabryella Soares, Elizabeth Nogueira, Jessica Silva, Camila Chaves, Cassiane Lucas, Graziela Loureiro, Vagner Rodrigues, Luiza Blanc.
- Quézia Karen (Supervisora): Nathalia Lima, Wellington Ramos, Isabelly Antunes, Ana Carolina Lopes, Ricardo - andamento processual, Vitor Pereira, Bruno Pimentel.
- Lorena Pontes (Supervisora): Juliana Silva, Gabryella Soares, Anderson Gregorio, Jessica Fernanda Soares, Nailson J.S.O, Tiago Anjos.

REGRAS DE DOMÍNIO:
1. Colaboradores ou tarefas fora destes 4 departamentos são agrupados na equipe "Indefinida".
2. Perguntas com supervisores ou setores de outros processos (ex: Cobrança Mensal, Negociação Mensal) estão fora do escopo do Andamento Processual.
`.trim()
