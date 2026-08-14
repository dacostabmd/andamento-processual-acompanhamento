import { useEffect, useMemo, useState } from 'react'
import { obterFotosColaboradores } from '../services/colaboradoresBitrix'

/**
 * Mapa id→URL da foto de perfil no Bitrix24, para os IDs em `idsRelevantes`
 * (ex.: responsável/fechador das tarefas visíveis, ou os 4 supervisores).
 * Cacheado em `colaboradoresBitrix.ts` por chave de IDs — chamadores
 * diferentes pedindo o mesmo conjunto reaproveitam a mesma busca.
 *
 * Passar só os IDs realmente necessários (em vez de todo o portal) é o que
 * evita a varredura paginada completa do `user.get`, que era o cold start dos
 * avatares e também a causa de alguns sumirem (paginação truncando antes de
 * alcançar certos IDs — ver comentário em `obterFotosColaboradores`).
 *
 * Vazio enquanto carrega, com `idsRelevantes` vazio, ou se a fonte Bitrix não
 * estiver disponível — os avatares caem no fallback de iniciais do
 * `UserAvatar`.
 */
export function useFotosColaboradores(idsRelevantes: number[]): Map<number, string> {
  const [fotos, setFotos] = useState<Map<number, string>>(new Map())
  // Chave estável para o array de dependência do efeito: sem isso, um novo
  // array com o MESMO conteúdo (comum quando o chamador faz `.map()` a cada
  // render) dispararia o efeito de novo a cada render.
  const chave = useMemo(
    () =>
      Array.from(new Set(idsRelevantes))
        .sort((a, b) => a - b)
        .join(','),
    [idsRelevantes],
  )

  useEffect(() => {
    let cancelado = false
    const ids = chave ? chave.split(',').map(Number) : []
    obterFotosColaboradores(ids).then((mapa) => {
      if (!cancelado) setFotos(mapa)
    })
    return () => {
      cancelado = true
    }
  }, [chave])

  return fotos
}
