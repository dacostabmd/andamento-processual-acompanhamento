/**
 * Métodos de projeção estatística para séries temporais de fluxo de trabalho (Kanban/Bitrix).
 * Substituem abordagens não estatísticas por métodos consagrados de mercado:
 * Regressão Linear Mínimos Quadrados, Média Móvel Ponderada e Simulação de Monte Carlo por Throughput.
 */

export interface PontoSerieNumerica {
  /** Chave "AAAA-MM-DD". */
  dia: string
  valor: number
}

export interface PontoProjecaoDiaria {
  dia: string
  valorProjetado: number
  valorConservador?: number
  valorOtimista?: number
}

export interface ResultadoProjecaoEstatistica {
  projecaoDiaria: PontoProjecaoDiaria[]
  projecaoSemanal: Array<{
    semanaLabel: string
    totalProjetado: number
    totalConservador?: number
    totalOtimista?: number
  }>
  narrativa: string
  meta: {
    metodo: 'regressao-linear' | 'media-movel' | 'monte-carlo'
    amostraDias: number
    alertaHistoricoCurto: boolean
    rQuadrado?: number
    p10Total30Dias?: number
    p50Total30Dias?: number
    p90Total30Dias?: number
  }
}

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
): Array<{
  semanaLabel: string
  totalProjetado: number
  totalConservador?: number
  totalOtimista?: number
}> {
  const semanas: Array<{
    semanaLabel: string
    totalProjetado: number
    totalConservador?: number
    totalOtimista?: number
  }> = []
  for (let i = 0; i < projecaoDiaria.length; i += 7) {
    const fatia = projecaoDiaria.slice(i, i + 7)
    if (fatia.length === 0) continue
    const inicio = rotuloDeData(fatia[0].dia)
    const fim = rotuloDeData(fatia[fatia.length - 1].dia)
    const soma = fatia.reduce((acc, p) => acc + p.valorProjetado, 0)
    const somaCons = fatia.reduce((acc, p) => acc + (p.valorConservador ?? p.valorProjetado), 0)
    const somaOti = fatia.reduce((acc, p) => acc + (p.valorOtimista ?? p.valorProjetado), 0)

    semanas.push({
      semanaLabel: `${inicio} - ${fim}`,
      totalProjetado: Math.round(soma),
      totalConservador: Math.round(somaCons),
      totalOtimista: Math.round(somaOti),
    })
  }
  return semanas.slice(0, 5)
}

/**
 * 1. Regressão Linear (Ordinary Least Squares - OLS)
 * Ajusta uma reta y = a*x + b sobre a série temporal histórica.
 */
export function projetarRegressaoLinear(
  serie: PontoSerieNumerica[],
  diasProjecao: number = 30,
): ResultadoProjecaoEstatistica {
  const n = serie.length
  if (n === 0) {
    return {
      projecaoDiaria: [],
      projecaoSemanal: [],
      narrativa: 'Sem dados históricos suficientes para projetar.',
      meta: { metodo: 'regressao-linear', amostraDias: 0, alertaHistoricoCurto: true },
    }
  }

  const mediaX = (n - 1) / 2
  const mediaY = serie.reduce((acc, p) => acc + p.valor, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - mediaX) * (serie[i].valor - mediaY)
    den += (i - mediaX) ** 2
  }

  const inclinacao = den === 0 ? 0 : num / den
  const intercepto = mediaY - inclinacao * mediaX

  // R² (Coeficiente de Determinação)
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const yPred = inclinacao * i + intercepto
    ssTot += (serie[i].valor - mediaY) ** 2
    ssRes += (serie[i].valor - yPred) ** 2
  }
  const rQuadrado = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)

  const ultimoDia = serie[n - 1].dia
  const projecaoDiaria: PontoProjecaoDiaria[] = []

  for (let k = 1; k <= diasProjecao; k++) {
    const xFuturo = n - 1 + k
    const valor = Math.max(0, Math.round(inclinacao * xFuturo + intercepto))
    projecaoDiaria.push({ dia: somarDias(ultimoDia, k), valorProjetado: valor })
  }

  const projecaoSemanal = consolidarSemanas(projecaoDiaria)
  const alertaHistoricoCurto = n < 14

  const tendenciaTexto =
    inclinacao > 0.05 ? 'crescimento' : inclinacao < -0.05 ? 'queda' : 'estabilidade'
  const narrativa =
    `Regressão Linear (OLS y = ${inclinacao.toFixed(2)}x + ${intercepto.toFixed(1)}): ` +
    `tendência diária de ${inclinacao >= 0 ? '+' : ''}${inclinacao.toFixed(2)} tarefas/dia (${tendenciaTexto}) com R² = ${(rQuadrado * 100).toFixed(1)}%. ` +
    (alertaHistoricoCurto
      ? `Atenção: Histórico de apenas ${n} dia(s) é curto para cobrir sazonalidades ou variações semanais.`
      : `Projeção calculada para os próximos ${diasProjecao} dias.`)

  return {
    projecaoDiaria,
    projecaoSemanal,
    narrativa,
    meta: {
      metodo: 'regressao-linear',
      amostraDias: n,
      alertaHistoricoCurto,
      rQuadrado,
    },
  }
}

/**
 * 2. Média Móvel (Janela ajustável de 7 a 14 dias)
 * Média móvel recente que reflete a vazão diária média real das entregas.
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
      meta: { metodo: 'media-movel', amostraDias: 0, alertaHistoricoCurto: true },
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
  const alertaHistoricoCurto = n < 14

  const narrativa =
    `Média Móvel dos últimos ${janelaEfetiva} dia(s) (${media.toFixed(1)} tarefas/dia), ` +
    `projetando um ritmo constante para os próximos ${diasProjecao} dias. ` +
    (alertaHistoricoCurto
      ? `Histórico de apenas ${n} dia(s) possui margem de erro maior devido a variações de finais de semana.`
      : `Ideal para medir baseline de curto prazo sem interferência de tendências distorcidas.`)

  return {
    projecaoDiaria,
    projecaoSemanal,
    narrativa,
    meta: {
      metodo: 'media-movel',
      amostraDias: n,
      alertaHistoricoCurto,
    },
  }
}

/**
 * 3. Simulação de Monte Carlo por Throughput (Vazão Ágil/Kanban)
 * Executa 1.000 simulações stocásticas reamostrando a vazão histórica diária
 * para gerar cenários probabilísticos: P50 (Esperado), P10 (Conservador) e P90 (Otimista).
 */
export function projetarMonteCarlo(
  serie: PontoSerieNumerica[],
  diasProjecao: number = 30,
  numSimulacoes: number = 1000,
): ResultadoProjecaoEstatistica {
  const n = serie.length
  if (n === 0) {
    return {
      projecaoDiaria: [],
      projecaoSemanal: [],
      narrativa: 'Sem dados históricos suficientes para simulação.',
      meta: { metodo: 'monte-carlo', amostraDias: 0, alertaHistoricoCurto: true },
    }
  }

  const vazaoHistorica = serie.map((p) => Math.max(0, p.valor))

  const simDiarias: number[][] = Array.from({ length: diasProjecao }, () => [])
  const simTotaisAcumulados: number[] = []

  for (let s = 0; s < numSimulacoes; s++) {
    let somaSimulacao = 0
    for (let k = 0; k < diasProjecao; k++) {
      const idxSorteado = Math.floor(Math.random() * n)
      const v = vazaoHistorica[idxSorteado]
      simDiarias[k].push(v)
      somaSimulacao += v
    }
    simTotaisAcumulados.push(somaSimulacao)
  }

  simTotaisAcumulados.sort((a, b) => a - b)
  const p10Total = simTotaisAcumulados[Math.floor(numSimulacoes * 0.1)]
  const p50Total = simTotaisAcumulados[Math.floor(numSimulacoes * 0.5)]
  const p90Total = simTotaisAcumulados[Math.floor(numSimulacoes * 0.9)]

  const ultimoDia = serie[n - 1].dia
  const projecaoDiaria: PontoProjecaoDiaria[] = []

  for (let k = 0; k < diasProjecao; k++) {
    const diaValores = simDiarias[k].sort((a, b) => a - b)
    const p10 = diaValores[Math.floor(numSimulacoes * 0.1)]
    const p50 = diaValores[Math.floor(numSimulacoes * 0.5)]
    const p90 = diaValores[Math.floor(numSimulacoes * 0.9)]

    projecaoDiaria.push({
      dia: somarDias(ultimoDia, k + 1),
      valorProjetado: p50,
      valorConservador: p10,
      valorOtimista: p90,
    })
  }

  const projecaoSemanal = consolidarSemanas(projecaoDiaria)
  const alertaHistoricoCurto = n < 14

  const narrativa =
    `Simulação de Monte Carlo por Throughput (${numSimulacoes} execuções): ` +
    `Cenário Provável (P50): ~${p50Total} tarefas acumuladas em ${diasProjecao} dias. ` +
    `Cenário Conservador (P10): ~${p10Total} tarefas (90% de confiança). ` +
    `Cenário Otimista (P90): ~${p90Total} tarefas. ` +
    (alertaHistoricoCurto
      ? `Atenção: Amostra histórica curta (${n} dias) pode achatar os intervalos da simulação.`
      : `Metodologia de ponta para previsão probabilística de fluxo de trabalho Kanban/Bitrix.`)

  return {
    projecaoDiaria,
    projecaoSemanal,
    narrativa,
    meta: {
      metodo: 'monte-carlo',
      amostraDias: n,
      alertaHistoricoCurto,
      p10Total30Dias: p10Total,
      p50Total30Dias: p50Total,
      p90Total30Dias: p90Total,
    },
  }
}
