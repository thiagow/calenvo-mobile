export interface CoverCropInput {
  srcWidth: number
  srcHeight: number
  targetWidth: number
  targetHeight: number
  /** Ponto de foco horizontal/vertical, 0 = borda esquerda/topo, 1 = direita/base. */
  focalX: number
  focalY: number
}

export interface CoverCropResult {
  /** Tamanho da imagem depois de escalada para cobrir o alvo. */
  resizeWidth: number
  resizeHeight: number
  /** Região do alvo dentro da imagem escalada. */
  left: number
  top: number
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5)

/**
 * Recorte "cover" com foco escolhido pelo usuário: escala a imagem até cobrir o
 * alvo e posiciona a janela pelo foco. É a mesma conta do CSS
 * `object-fit: cover; object-position: X% Y%` — por isso o preview no navegador
 * mostra exatamente o que o servidor grava.
 */
export function computeCoverCrop(input: CoverCropInput): CoverCropResult {
  const { srcWidth, srcHeight, targetWidth, targetHeight } = input
  const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight)

  // Math.max/ceil garantem que a imagem escalada nunca fique menor que o alvo
  // por arredondamento (o extract do sharp falha se a janela passar do limite).
  const resizeWidth = Math.max(targetWidth, Math.ceil(srcWidth * scale))
  const resizeHeight = Math.max(targetHeight, Math.ceil(srcHeight * scale))

  return {
    resizeWidth,
    resizeHeight,
    left: Math.round((resizeWidth - targetWidth) * clamp01(input.focalX)),
    top: Math.round((resizeHeight - targetHeight) * clamp01(input.focalY)),
  }
}

/** Lê um foco vindo de formulário; ausente ou inválido vira o centro. */
export function parseFocal(value: unknown): number {
  if (typeof value !== 'string' || value.trim() === '') return 0.5
  return clamp01(Number(value))
}
