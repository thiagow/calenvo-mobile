import { describe, expect, it } from 'vitest'
import {
  BOOKING_TEMPLATES,
  TEMPLATES,
  contrastRatio,
  getContrastWarnings,
  hexToHsl,
  isValidHex,
  mix,
  pickForeground,
  resolveTheme,
} from '@/lib/booking-theme'

describe('isValidHex', () => {
  it('aceita apenas #RRGGBB', () => {
    expect(isValidHex('#7C3AED')).toBe(true)
    expect(isValidHex('#7c3aed')).toBe(true)
    expect(isValidHex('7C3AED')).toBe(false)
    expect(isValidHex('#FFF')).toBe(false)
    expect(isValidHex('#GGGGGG')).toBe(false)
    expect(isValidHex('url(javascript:alert(1))')).toBe(false)
    expect(isValidHex(null)).toBe(false)
  })
})

describe('hexToHsl', () => {
  it('converte para o formato dos tokens shadcn', () => {
    expect(hexToHsl('#FFFFFF')).toBe('0 0% 100%')
    expect(hexToHsl('#000000')).toBe('0 0% 0%')
    expect(hexToHsl('#FF0000')).toBe('0 100% 50%')
    expect(hexToHsl('#00FF00')).toBe('120 100% 50%')
    expect(hexToHsl('#0000FF')).toBe('240 100% 50%')
  })
})

describe('contraste', () => {
  it('preto sobre branco é 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('é simétrico', () => {
    expect(contrastRatio('#123456', '#FEDCBA')).toBeCloseTo(contrastRatio('#FEDCBA', '#123456'), 5)
  })

  it('pickForeground escolhe texto claro em fundo escuro e vice-versa', () => {
    expect(pickForeground('#1C1C1E')).toBe('#FFFFFF')
    expect(pickForeground('#F5EFE6')).toBe('#0A0A0A')
    // amarelo é claro: precisa de texto escuro, não branco
    expect(pickForeground('#FFD600')).toBe('#0A0A0A')
  })
})

describe('mix', () => {
  it('extremos devolvem as cores originais', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF')
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })
})

describe('resolveTheme', () => {
  it('sem input usa o template NATURAL e capa desligada', () => {
    const t = resolveTheme()
    expect(t.template).toBe('NATURAL')
    expect(t.colors.background).toBe(TEMPLATES.NATURAL.bg)
    expect(t.coverEnabled).toBe(false)
    expect(t.isDark).toBe(false)
  })

  it('template desconhecido cai no padrão em vez de quebrar a página', () => {
    const t = resolveTheme({ template: 'INEXISTENTE' as never })
    expect(t.template).toBe('NATURAL')
  })

  it('cor nula usa o padrão do template; cor válida sobrescreve', () => {
    const padrao = resolveTheme({ template: 'CLEAN', bgColor: null })
    expect(padrao.colors.background).toBe(TEMPLATES.CLEAN.bg)

    const custom = resolveTheme({ template: 'CLEAN', bgColor: '#ffeedd' })
    expect(custom.colors.background).toBe('#FFEEDD')
  })

  it('hex inválido é ignorado (nunca vai parar em CSS)', () => {
    const t = resolveTheme({ accentColor: 'red; background: url(x)' })
    expect(t.colors.primary).toBe(TEMPLATES.NATURAL.accent)
    for (const v of Object.values(t.cssVars)) {
      expect(v).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/)
    }
  })

  it('DARK é escuro; fundo claro em template DARK deixa de ser escuro', () => {
    expect(resolveTheme({ template: 'DARK' }).isDark).toBe(true)
    expect(resolveTheme({ template: 'DARK', bgColor: '#FFFFFF' }).isDark).toBe(false)
    expect(resolveTheme({ template: 'NATURAL', bgColor: '#000000' }).isDark).toBe(true)
  })

  it('o texto do botão acompanha a luminosidade da cor de destaque', () => {
    const claro = resolveTheme({ accentColor: '#FFD600' })
    const escuro = resolveTheme({ accentColor: '#1E1B4B' })
    expect(claro.colors.primaryForeground).toBe('#0A0A0A')
    expect(escuro.colors.primaryForeground).toBe('#FFFFFF')
  })

  it('VIBRANT usa cards de entrada sólidos na cor de destaque com texto legível', () => {
    const t = resolveTheme({ template: 'VIBRANT' })
    expect(t.colors.entryCard).not.toBe(t.colors.card)
    expect(contrastRatio(t.colors.entryCard, t.colors.entryCardForeground)).toBeGreaterThanOrEqual(4.5)
  })

  it('os demais steps nunca recebem card sólido: --card segue a superfície', () => {
    const t = resolveTheme({ template: 'VIBRANT' })
    expect(contrastRatio(t.colors.card, t.colors.cardForeground)).toBeGreaterThanOrEqual(4.5)
    expect(t.cssVars['--card']).not.toBe(t.cssVars['--bk-entry-card'])
  })

  it('capa só liga com true explícito e preserva a chave enviada', () => {
    expect(resolveTheme({ coverEnabled: undefined }).coverEnabled).toBe(false)
    const t = resolveTheme({ coverEnabled: true, coverImage: 'covers/abc.webp' })
    expect(t.coverEnabled).toBe(true)
    expect(t.coverImage).toBe('covers/abc.webp')
  })

  it.each(BOOKING_TEMPLATES)('os padrões do template %s são legíveis', (template) => {
    const t = resolveTheme({ template })
    expect(getContrastWarnings(t)).toEqual([])
    expect(contrastRatio(t.colors.primary, t.colors.primaryForeground)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('getContrastWarnings', () => {
  it('avisa quando o texto some no fundo', () => {
    const t = resolveTheme({ bgColor: '#FFFFFF', textColor: '#F0F0F0' })
    expect(getContrastWarnings(t).some((w) => w.field === 'text')).toBe(true)
  })

  it('avisa quando o destaque se confunde com o fundo', () => {
    const t = resolveTheme({ bgColor: '#FFFFFF', accentColor: '#FAFAFA' })
    expect(getContrastWarnings(t).some((w) => w.field === 'accent')).toBe(true)
  })
})
