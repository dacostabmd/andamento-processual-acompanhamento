import classes from './CabecalhoOrdenavel.module.css'
import type { DirecaoOrdem, EstadoOrdem } from './ordenacao'

interface Props<C extends string> {
  /** Chave da coluna no estado de ordenação. */
  chave: C
  rotulo: string
  ordem: EstadoOrdem<C>
  aoOrdenar: (chave: C, direcaoInicial?: DirecaoOrdem) => void
  /** Direção do PRIMEIRO clique nesta coluna. Texto: 'asc'. Número/data: às vezes 'desc'. */
  direcaoInicial?: DirecaoOrdem
  alinhamento?: 'esquerda' | 'direita' | 'centro'
  /** Classes de largura da coluna (ex.: "w-32"). O padding fica no botão. */
  className?: string
}

/**
 * `<th>` que ordena a tabela ao ser clicado, com seta indicando a direção.
 *
 * Compartilhado pelo ranking de fechamento e pelo modal de tarefas da pessoa —
 * as duas tabelas grandes do painel. O `aria-sort` fica no `th` (é lá que o
 * leitor de tela procura), e o clique no `button` interno, que é o elemento
 * focável por teclado.
 */
export function CabecalhoOrdenavel<C extends string>({
  chave,
  rotulo,
  ordem,
  aoOrdenar,
  direcaoInicial = 'asc',
  alinhamento = 'esquerda',
  className = '',
}: Props<C>) {
  const ativa = ordem.chave === chave
  const descendente = ativa && ordem.direcao === 'desc'

  return (
    <th
      scope="col"
      aria-sort={ativa ? (descendente ? 'descending' : 'ascending') : 'none'}
      className={`p-0 ${className}`}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(chave, direcaoInicial)}
        title={`Ordenar por ${rotulo}`}
        className={`${classes.botao} ${classes[alinhamento]} ${ativa ? classes.ativo : ''}`}
      >
        <span className={classes.rotulo}>{rotulo}</span>
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${classes.seta} ${ativa ? classes.setaAtiva : ''} ${
            descendente ? classes.setaDescendente : ''
          }`}
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
    </th>
  )
}
