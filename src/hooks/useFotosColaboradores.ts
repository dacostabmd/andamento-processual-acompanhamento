import { useEffect, useState } from 'react'
import { obterFotosColaboradores } from '../services/colaboradoresBitrix'

/**
 * Mapa id→URL da foto de perfil no Bitrix24, carregado uma vez por sessão
 * (cache em `colaboradoresBitrix.ts`) e compartilhado por todo componente que
 * chamar este hook. Vazio enquanto carrega ou se a fonte Bitrix não estiver
 * disponível — os avatares caem no fallback de iniciais do `UserAvatar`.
 */
export function useFotosColaboradores(): Map<number, string> {
  const [fotos, setFotos] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    let cancelado = false
    obterFotosColaboradores().then((mapa) => {
      if (!cancelado) setFotos(mapa)
    })
    return () => {
      cancelado = true
    }
  }, [])

  return fotos
}
