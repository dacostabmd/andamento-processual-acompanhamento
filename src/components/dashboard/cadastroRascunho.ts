import {
  CAMPOS_CADASTRO_PESSOA,
  type CampoCadastroPessoa,
  type PessoaCadastro,
  type VinculoEfetivo,
} from '../../types/domain'

/**
 * Estado de edição dos vínculos de uma pessoa, e o diff que vai ao worker.
 *
 * Mora fora do componente porque é a parte da tela onde um erro silencioso custa
 * dado — ver `calcularAlteracoes` — e porque é testável sem montar React.
 */

/**
 * Os três estados possíveis de um vínculo, e é preciso que sejam três:
 *
 *   herdar      → sem definição manual; vale o que o Bitrix diz (ou nada, para
 *                 gerente/diretor/UF, que não existem no portal)
 *   definir     → vínculo escolhido à mão, vence o Bitrix
 *   desassociar → decisão explícita de "não há vínculo"; o Bitrix NÃO volta a valer
 *
 * Sem o terceiro, desassociar alguém do supervisor seria indistinguível de nunca
 * ter mexido, e o sync da meia-noite devolveria o valor do portal por cima — a
 * correção duraria até 00:00 e voltaria sozinha.
 */
export type ModoVinculo = 'herdar' | 'definir' | 'desassociar'

export interface RascunhoVinculo {
  modo: ModoVinculo
  id: number | null
  nome: string | null
  /** Só em `departamento`: a lista completa que o MultiSelect edita. */
  ids?: number[]
}

/** Campos que guardam uma LISTA (MultiSelect). */
export const CAMPOS_MULTIPLOS: CampoCadastroPessoa[] = [
  'departamento',
  'departamento_estado',
  'supervisor',
  'gerente',
  'diretor',
  'estado_uf',
]

export type Rascunho = Record<CampoCadastroPessoa, RascunhoVinculo>

/** Campos que TÊM fonte no Bitrix — só neles "herdar" e "desassociar" diferem. */
export const CAMPOS_COM_FONTE_BITRIX: CampoCadastroPessoa[] = ['departamento', 'supervisor']

export function vinculoDaPessoa(
  pessoa: PessoaCadastro,
  campo: CampoCadastroPessoa,
): VinculoEfetivo {
  if (campo === 'estado_uf') return pessoa.estadoUf
  if (campo === 'departamento_estado') return pessoa.departamentoEstado
  return pessoa[campo]
}

/**
 * Traduz o vínculo efetivo no rascunho do controle.
 *
 * O valor (`id`/`nome`/`ids`) é preservado nos TRÊS modos, e não só em 'definir':
 * é o que faz o controle abrir já preenchido com o que vale hoje, inclusive quando
 * o valor é herdado do Bitrix. Um campo vazio sobre um dado que existe leva a
 * pessoa a preencher de novo o que já estava certo — ou a salvar em cima com menos
 * informação do que havia.
 */
export function rascunhoDoVinculo(vinculo?: VinculoEfetivo | null): RascunhoVinculo {
  if (!vinculo) return { modo: 'herdar', id: null, nome: null }
  const ids = vinculo.itens ? vinculo.itens.map((i) => i.id) : undefined
  if (vinculo.origem === 'cadastro') {
    return { modo: 'definir', id: vinculo.id, nome: vinculo.nome, ids }
  }
  if (vinculo.origem === 'desassociado') {
    return { modo: 'desassociar', id: null, nome: null, ids: ids ? [] : undefined }
  }
  return { modo: 'herdar', id: vinculo.id, nome: vinculo.nome, ids }
}

/** Duas listas com os mesmos elementos, em qualquer ordem. */
function mesmaLista(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const conjunto = new Set(b)
  return a.every((item) => conjunto.has(item))
}

/**
 * A lista de um vínculo múltiplo, tolerando o formato antigo de um id só.
 *
 * `ids` ausente NÃO é lista vazia: é um vínculo que veio de antes de o campo ser
 * múltiplo. Tratá-lo como vazio faria a comparação enxergar uma remoção que
 * ninguém pediu, e o salvamento desassociaria a pessoa de todos os departamentos.
 */
export function listaDoRascunho(vinculo: RascunhoVinculo): number[] {
  if (vinculo.ids) return vinculo.ids
  return vinculo.id !== null ? [vinculo.id] : []
}

export function rascunhoDaPessoa(pessoa: PessoaCadastro): Rascunho {
  return {
    departamento: rascunhoDoVinculo(pessoa.departamento),
    departamento_estado: rascunhoDoVinculo(pessoa.departamentoEstado),
    supervisor: rascunhoDoVinculo(pessoa.supervisor),
    gerente: rascunhoDoVinculo(pessoa.gerente),
    diretor: rascunhoDoVinculo(pessoa.diretor),
    estado_uf: rascunhoDoVinculo(pessoa.estadoUf),
  }
}

/**
 * Sigla da UF embutida no nome de um departamento de estado ("Andamento - SP").
 *
 * Serve para o modal preencher o campo de UF junto quando alguém escolhe o
 * departamento de estado: são a mesma informação dita de duas formas, e deixar os
 * dois campos discordarem na tela é convite para gravar um "Andamento - SP" com
 * UF "RJ". O preenchimento fica VISÍVEL no rascunho antes de salvar, e pode ser
 * trocado — não é um efeito escondido.
 */
export function ufDoDepartamentoEstado(nome: string | null): string | null {
  const match = (nome ?? '').match(/-\s*([A-Za-z]{2})\s*$/)
  return match ? match[1].toUpperCase() : null
}

export interface AlteracoesCadastro {
  /** Campos a gravar (definir ou desassociar). */
  definir: Partial<
    Record<CampoCadastroPessoa, { id: number | null; nome: string | null; ids?: number[] }>
  >
  /** Campos a devolver ao Bitrix (apagar a definição manual). */
  reverter: CampoCadastroPessoa[]
}

/**
 * O que precisa ser enviado ao worker para o cadastro passar de `original` para
 * `rascunho` — nada além disso.
 *
 * O "nada além disso" é o ponto: reenviar um valor idêntico gera uma linha de log
 * falsa e uma reaplicação sobre milhares de tarefas, e pedir reversão de um campo
 * que nunca teve definição manual leva 404 do worker ("esta pessoa não tem
 * cadastro manual") — o que apareceria na tela como falha de um salvamento que na
 * verdade deu certo.
 */
export function calcularAlteracoes(
  original: PessoaCadastro,
  rascunho: Rascunho,
): AlteracoesCadastro {
  const definir: AlteracoesCadastro['definir'] = {}
  const reverter: CampoCadastroPessoa[] = []

  for (const campo of CAMPOS_CADASTRO_PESSOA) {
    const atual = rascunho[campo]
    const antes = rascunhoDoVinculo(vinculoDaPessoa(original, campo))

    if (atual.modo === 'definir') {
      const idsAtuais = listaDoRascunho(atual)
      const idsAntigos = listaDoRascunho(antes)

      const identico =
        antes.modo === 'definir' &&
        (campo === 'departamento' || (atual.ids && atual.ids.length > 1)
          ? mesmaLista(idsAntigos, idsAtuais)
          : antes.id === atual.id && antes.nome === atual.nome)

      if (!identico) {
        if (campo === 'departamento' || (atual.ids && atual.ids.length > 1)) {
          definir[campo] = { id: idsAtuais[0] ?? null, nome: atual.nome, ids: idsAtuais }
        } else {
          definir[campo] = { id: atual.id, nome: atual.nome }
        }
      }
    } else if (atual.modo === 'desassociar') {
      if (antes.modo !== 'desassociar') {
        definir[campo] =
          campo === 'departamento' ? { id: null, nome: null, ids: [] } : { id: null, nome: null }
      }
    } else if (antes.modo !== 'herdar') {
      reverter.push(campo)
    }
  }

  return { definir, reverter }
}
