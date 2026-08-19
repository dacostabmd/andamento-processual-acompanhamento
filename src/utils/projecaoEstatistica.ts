/**
 * Métodos de projeção estatística local — não dependem de chamada de rede/LLM.
 * Complementam a projeção via IA (worker + GPT-4o, ver services/projecaoApi.ts)
 * com métodos determinísticos e auditáveis, aplicáveis a qualquer série diária
 * numérica (tarefas criadas, concluídas, faturamento etc).
 */

export interface PontoSerieNumerica {
  /** Chave "AAAA-MM-DD". */
  dia: string
  valor: number
}

export interface PontoProjecaoDiaria {
  dia: string
  valorProjetado: number
}

export interface ResultadoProjecaoEstatistica {
  projecaoDiaria: PontoProjecaoDiaria[]
  projecaoSemanal: Array<{ semanaLabel: string; totalProjetado: number }>
  narrativa: string
  meta: { metodo: string; amostraDias: number }
}

const RAZAO_AUREA_INVERSA = 0.6180339887498949 // 1/φ

function somarDias(diaIso: string, quantidade: number): string {
  const [ano, mes, dia] = diaIso.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia)
  data.setDate(data.getDate() + quantidade)
  const anoOut = data.getFullYear()
  const mesOut = String(data.getMonth() + 1).padStart(2, '0')
  const diaOut = String(data.getDate()).padStart(2, '0')
  return `${anoOut}-${mesOut}-${diaOut}`
}

function rotuloDeData(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return dia && mes ? `${dia}/${mes}` : iso
}

function consolidarSemanas(
  projecaoDiaria: PontoProjecaoDiaria[],
): Array<{ semanaLabel: string; totalProjetado: number }> {
  const semanas: Array<{ semanaLabel: string; totalProjetado: number }> = []
  for (let i = 0; i < projecaoDiaria.length; i += 7) {
    const fatia = projecaoDiaria.slice(i, i + 7)
    if (fatia.length === 0) continue
    const inicio = rotuloDeData(fatia[0].dia)
    const fim = rotuloDeData(fatia[fatia.length - 1].dia)
    const soma = fatia.reduce((acc, p) => acc + p.valorProjetado, 0)
    semanas.push({ semanaLabel: `${inicio} - ${fim}`, totalProjetado: Math.round(soma) })
  }
  return semanas.slice(0, 5)
}

/**
 * Suavização exponencial com fator de decaimento derivado da razão áurea
 * (peso do dia a `d` dias de distância do mais recente = (1/φ)^d ≈ 0,618^d).
 * A tendência (inclinação) é estimada por regressão linear dos valores
 * históricos, ponderada pelos mesmos pesos — dias recentes pesam mais tanto
 * no nível quanto na inclinação. A projeção estende nível + inclinação por
 * dia, sem sazonalidade.
 *
 * Nível ponderado:    L = Σ(peso_i · valor_i) / Σ(peso_i)
 * Inclinação (b):     regressão linear ponderada de valor_i sobre o índice i
 * Projeção(dia k):     L + b · k,  k = 1..30 (nunca negativa)
 */
export function projetarFibonacci(
  serie: PontoSerieNumerica[],
  diasProjecao: number = 30,
): ResultadoProjecaoEstatistica {
  const n = serie.length
  if (n === 0) {
    return {
      projecaoDiaria: [],
      projecaoSemanal: [],
      narrativa: 'Sem dados históricos suficientes para projetar.',
      meta: { metodo: 'fibonacci', amostraDias: 0 },
    }
  }

  const pesos = serie.map((_, i) => RAZAO_AUREA_INVERSA ** (n - 1 - i))
  const somaPesos = pesos.reduce((a, b) => a + b, 0)

  const nivel = serie.reduce((acc, p, i) => acc + p.valor * pesos[i], 0) / somaPesos

  const mediaIndicePonderada = serie.reduce((acc, _, i) => acc + i * pesos[i], 0) / somaPesos
  const numerador = serie.reduce(
    (acc, p, i) => acc + pesos[i] * (i - mediaIndicePonderada) * (p.valor - nivel),
    0,
  )
  const denominador = serie.reduce(
    (acc, _, i) => acc + pesos[i] * (i - mediaIndicePonderada) ** 2,
    0,
  )
  const inclinacao = denominador === 0 ? 0 : numerador / denominador

  const ultimoDia = serie[n - 1].dia
  const projecaoDiaria: PontoProjecaoDiaria[] = []
  for (let k = 1; k <= diasProjecao; k++) {
    const valor = Math.max(0, Math.round(nivel + inclinacao * k))
    projecaoDiaria.push({ dia: somarDias(ultimoDia, k), valorProjetado: valor })
  }

  const projecaoSemanal = consolidarSemanas(projecaoDiaria)
  const tendenciaTexto =
    inclinacao > 0.05 ? 'crescimento' : inclinacao < -0.05 ? 'queda' : 'estabilidade'
  const narrativa =
    `Suavização exponencial com peso (1/φ)^d por dia de distância (d=0 é o dia mais ` +
    `recente): nível ponderado ≈ ${nivel.toFixed(1)}, com tendência diária de ` +
    `${inclinacao >= 0 ? '+' : ''}${inclinacao.toFixed(2)}/dia (${tendenciaTexto}). ` +
    `A projeção estende nível + tendência linearmente para os próximos ${diasProjecao} dias.`

  return {
    projecaoDiaria,
    projecaoSemanal,
    narrativa,
    meta: { metodo: 'fibonacci', amostraDias: n },
  }
}

/**
 * Média móvel simples de janela fixa (7 dias) sobre os últimos dados
 * históricos, repetida como valor constante para todos os dias futuros —
 * método "ingênuo" (naive), sem tendência nem sazonalidade, usado como
 * referência de comparação (baseline) para os demais métodos.
 *
 * Projeção(dia k) = média dos últimos min(7, n) valores da série, para todo k.
 */
export function projetarMediaMovel(
  serie: PontoSerieNumerica[],
  diasProjecao: number = 30,
  janela: number = 7,
): ResultadoProjecaoEstatistica {
  const n = serie.length
  if (n === 0) {
    return {
      projecaoDiaria: [],
      projecaoSemanal: [],
      narrativa: 'Sem dados históricos suficientes para projetar.',
      meta: { metodo: 'media-movel', amostraDias: 0 },
    }
  }

  const janelaEfetiva = Math.min(janela, n)
  const ultimosValores = serie.slice(n - janelaEfetiva).map((p) => p.valor)
  const media = ultimosValores.reduce((a, b) => a + b, 0) / janelaEfetiva
  const valorConstante = Math.max(0, Math.round(media))

  const ultimoDia = serie[n - 1].dia
  const projecaoDiaria: PontoProjecaoDiaria[] = []
  for (let k = 1; k <= diasProjecao; k++) {
    projecaoDiaria.push({ dia: somarDias(ultimoDia, k), valorProjetado: valorConstante })
  }

  const projecaoSemanal = consolidarSemanas(projecaoDiaria)
  const narrativa =
    `Média móvel simples dos últimos ${janelaEfetiva} dia(s) (${media.toFixed(1)}), ` +
    `repetida como valor constante para os próximos ${diasProjecao} dias — não considera ` +
    `tendência de alta/baixa nem sazonalidade, servindo como referência de comparação ` +
    `(baseline) com os demais métodos.`

  return {
    projecaoDiaria,
    projecaoSemanal,
    narrativa,
    meta: { metodo: 'media-movel', amostraDias: n },
  }
}
