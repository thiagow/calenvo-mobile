import { describe, it, expect } from 'vitest'
import { computeCoverCrop, parseFocal } from '@/lib/cover-crop'

const target = { targetWidth: 1600, targetHeight: 700 }

describe('computeCoverCrop', () => {
  it('foto mais alta que a capa: escala pela largura e o foco move só o eixo Y', () => {
    const base = { srcWidth: 2000, srcHeight: 2000, ...target }
    const top = computeCoverCrop({ ...base, focalX: 0.5, focalY: 0 })
    const mid = computeCoverCrop({ ...base, focalX: 0.5, focalY: 0.5 })
    const bottom = computeCoverCrop({ ...base, focalX: 0.5, focalY: 1 })

    expect([top.resizeWidth, top.resizeHeight]).toEqual([1600, 1600])
    expect([top.left, top.top]).toEqual([0, 0])
    expect(mid.top).toBe(450)
    expect(bottom.top).toBe(900) // 1600 - 700
  })

  it('foto mais larga que a capa: escala pela altura e o foco move só o eixo X', () => {
    const base = { srcWidth: 4000, srcHeight: 1000, ...target }
    const left = computeCoverCrop({ ...base, focalX: 0, focalY: 0.5 })
    const right = computeCoverCrop({ ...base, focalX: 1, focalY: 0.5 })

    expect([left.resizeWidth, left.resizeHeight]).toEqual([2800, 700])
    expect([left.left, left.top]).toEqual([0, 0])
    expect(right.left).toBe(1200) // 2800 - 1600
  })

  it('foto já na proporção da capa: sem sobra, offset 0 para qualquer foco', () => {
    const r = computeCoverCrop({ srcWidth: 3200, srcHeight: 1400, ...target, focalX: 1, focalY: 1 })
    expect([r.resizeWidth, r.resizeHeight, r.left, r.top]).toEqual([1600, 700, 0, 0])
  })

  it('a janela nunca passa do limite da imagem escalada (arredondamento)', () => {
    for (const [w, h] of [[1999, 1001], [1234, 4321], [4001, 999]]) {
      const r = computeCoverCrop({ srcWidth: w, srcHeight: h, ...target, focalX: 1, focalY: 1 })
      expect(r.left + 1600).toBeLessThanOrEqual(r.resizeWidth)
      expect(r.top + 700).toBeLessThanOrEqual(r.resizeHeight)
    }
  })

  it('foco fora de [0,1] é limitado e NaN vira o centro', () => {
    const base = { srcWidth: 2000, srcHeight: 2000, ...target, focalX: 0.5 }
    expect(computeCoverCrop({ ...base, focalY: 9 }).top).toBe(900)
    expect(computeCoverCrop({ ...base, focalY: -3 }).top).toBe(0)
    expect(computeCoverCrop({ ...base, focalY: NaN }).top).toBe(450)
  })
})

describe('parseFocal', () => {
  it('lê números, limita e usa o centro quando ausente ou inválido', () => {
    expect(parseFocal('0.25')).toBe(0.25)
    expect(parseFocal('2')).toBe(1)
    expect(parseFocal('-1')).toBe(0)
    expect(parseFocal('abc')).toBe(0.5)
    expect(parseFocal('')).toBe(0.5)
    expect(parseFocal(null)).toBe(0.5)
    expect(parseFocal(undefined)).toBe(0.5)
  })
})
