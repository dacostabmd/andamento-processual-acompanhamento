import { GRUPOS_MONITORADOS } from './bitrixConfig'
import type { Projeto } from '../types/domain'

/**
 * "Modo mock de desenvolvimento": ativo quando rodando em DEV (`npm run dev`) e
 * SEM o serviço de sync configurado (`VITE_SYNC_API_URL` vazio). Nesse cenário o
 * app não tem como falar com a VPS nem com o Bitrix ao vivo (webhook exige token
 * e retornaria 401), então servimos um snapshot mock e curto-circuitamos o fluxo
 * de acesso — para o dashboard renderizar 100% offline, útil para validar UI.
 *
 * Em produção `import.meta.env.DEV` é falso, o Vite elimina esse ramo, e nada de
 * mock jamais chega ao usuário final.
 */
export function modoMockDevAtivo(): boolean {
  return import.meta.env.DEV && !import.meta.env.VITE_SYNC_API_URL?.trim()
}

/** Nomes reais dos grupos monitorados — só usados no mock; em produção vêm do Bitrix via webhook. */
const NOME_GRUPO_MOCK: Record<number, string> = {
  86: 'Acompanhamento Mensal',
  92: 'Cobrança Mensal',
  94: 'Negociação Mensal',
}

/** Projetos permitidos "de mentira" (todos os monitorados) para o modo mock. */
export function projetosMonitoradosMock(): Projeto[] {
  return GRUPOS_MONITORADOS.map((id) => ({ id, nome: NOME_GRUPO_MOCK[id] ?? `Grupo ${id}` }))
}
