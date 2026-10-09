/**
 * Motor de tema da página pública de agendamento.
 *
 * Recebe o template escolhido + overrides opcionais de cor e devolve as CSS
 * variables (no formato HSL "h s% l%" esperado pelos tokens shadcn) já com
 * cores derivadas legíveis. Puro e sem dependências, usado tanto no servidor
 * (layout público) quanto no editor do dashboard (preview ao vivo).
 */

export const BOOKING_TEMPLATES = ['NATURAL', 'VIBRANT', 'CLEAN', 'DARK'] as const
export type BookingTemplateId = (typeof BOOKING_TEMPLATES)[number]

export interface BookingThemeInput {
  template?: BookingTemplateId | null
  bgColor?: string | null
  textColor?: string | null
  accentColor?: string | null
  coverEnabled?: boolean | null
  coverImage?: string | null
}

interface TemplateDefinition {
  label: string
  description: string
  bg: string
  text: string
  accent: string
  /**
   * Aparência dos 2 cards da tela de entrada. 'surface': superfície sobre o
   * fundo. 'accent': sólidos na cor de destaque. Os demais steps sempre usam
   * `surface` (herdam text-foreground, que não funciona sobre cards sólidos).
   */
  entryCardMode: 'surface' | 'accent'
  headingFont: 'serif' | 'sans'
  coverPreset: string
}

export const TEMPLATES: Record<BookingTemplateId, TemplateDefinition> = {
  NATURAL: {
    label: 'Natural & Minimalista',
    description: 'Tons terrosos, sombras suaves e tipografia editorial.',
    bg: '#F5EFE6',
    text: '#4A3426',
    accent: '#8C7A5B',
    entryCardMode: 'surface',
    headingFont: 'serif',
    coverPreset: '/booking-covers/natural.webp',
  },
  VIBRANT: {
    label: 'Vibrante & Moderno',
    description: 'Cores fortes, cards sólidos e energia jovem.',
    bg: '#E9DDFB',
    text: '#2A0F5C',
    accent: '#4C1D95',
    entryCardMode: 'accent',
    headingFont: 'sans',
    coverPreset: '/booking-covers/vibrant.webp',
  },
  CLEAN: {
    label: 'SaaS Clean',
    description: 'Fundo claro com grade sutil, cards nítidos e foco em clareza.',
    bg: '#F3F6FC',
    text: '#14183A',
    accent: '#3730A3',
    entryCardMode: 'surface',
    headingFont: 'sans',
    coverPreset: '/booking-covers/clean.webp',
  },
  DARK: {
    label: 'Premium & Dark',
    description: 'Fundo escuro, detalhes dourados e cards em vidro.',
    bg: '#1C1C1E',
    text: '#E8D9BC',
    accent: '#C9A66B',
    entryCardMode: 'surface',
    headingFont: 'serif',
    coverPreset: '/booking-covers/dark.webp',
  },
}

export const DEFAULT_TEMPLATE: BookingTemplateId = 'NATURAL'

// --- Cor -------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value)
}

type Rgb = readonly [number, number, number]

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

/** Mistura `a` com `b`; t=0 devolve `a`, t=1 devolve `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t])
}

export function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Preto ou branco, o que tiver mais contraste sobre `bg`. */
export function pickForeground(bg: string): string {
  return contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#0A0A0A') ? '#FFFFFF' : '#0A0A0A'
}

/** Formato dos tokens shadcn: "h s% l%" (sem o wrapper hsl()). */
export function hexToHsl(hex: string): string {
  const [r8, g8, b8] = hexToRgb(hex)
  const r = r8 / 255
  const g = g8 / 255
  const b = b8 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return `${round(h)} ${round(s * 100)}% ${round(l * 100)}%`
}

function round(v: number): number {
  return Math.round(v * 10) / 10
}

// --- Resolução -------------------------------------------------------------

export interface ResolvedBookingTheme {
  template: BookingTemplateId
  isDark: boolean
  headingFont: 'serif' | 'sans'
  colors: {
    background: string
    foreground: string
    card: string
    cardForeground: string
    entryCard: string
    entryCardForeground: string
    primary: string
    primaryForeground: string
    mutedForeground: string
    border: string
  }
  /** Variáveis prontas para `style={...}` (formato HSL dos tokens shadcn). */
  cssVars: Record<string, string>
  coverEnabled: boolean
  /** Chave de storage da capa enviada; nulo quando usa o preset. */
  coverImage: string | null
  coverPreset: string
}

function pickHex(value: string | null | undefined, fallback: string): string {
  return isValidHex(value) ? value.toUpperCase() : fallback
}

export function resolveTheme(input: BookingThemeInput = {}): ResolvedBookingTheme {
  const template: BookingTemplateId =
    input.template && input.template in TEMPLATES ? input.template : DEFAULT_TEMPLATE
  const def = TEMPLATES[template]

  const background = pickHex(input.bgColor, def.bg)
  const foreground = pickHex(input.textColor, def.text)
  const primary = pickHex(input.accentColor, def.accent)
  const isDark = luminance(background) < 0.18

  const primaryForeground = pickForeground(primary)
  const mutedForeground = mix(foreground, background, 0.38)
  const border = mix(background, foreground, isDark ? 0.18 : 0.12)

  const card = isDark ? mix(background, '#FFFFFF', 0.07) : mix(background, '#FFFFFF', 0.6)
  const cardForeground = foreground

  let entryCard = card
  let entryCardForeground = cardForeground
  if (def.entryCardMode === 'accent') {
    entryCard = mix(primary, '#000000', 0.15)
    entryCardForeground = pickForeground(entryCard)
  }

  const colors = {
    background,
    foreground,
    card,
    cardForeground,
    entryCard,
    entryCardForeground,
    primary,
    primaryForeground,
    mutedForeground,
    border,
  }

  const cssVars: Record<string, string> = {
    '--background': hexToHsl(background),
    '--foreground': hexToHsl(foreground),
    '--card': hexToHsl(card),
    '--card-foreground': hexToHsl(cardForeground),
    '--popover': hexToHsl(card),
    '--popover-foreground': hexToHsl(cardForeground),
    '--primary': hexToHsl(primary),
    '--primary-foreground': hexToHsl(primaryForeground),
    '--muted': hexToHsl(mix(background, foreground, 0.06)),
    '--muted-foreground': hexToHsl(mutedForeground),
    '--accent': hexToHsl(mix(background, primary, 0.14)),
    '--accent-foreground': hexToHsl(foreground),
    '--border': hexToHsl(border),
    '--input': hexToHsl(border),
    '--ring': hexToHsl(primary),
    '--bk-entry-card': hexToHsl(entryCard),
    '--bk-entry-card-foreground': hexToHsl(entryCardForeground),
    '--bk-entry-card-muted': hexToHsl(mix(entryCardForeground, entryCard, 0.3)),
  }

  return {
    template,
    isDark,
    headingFont: def.headingFont,
    colors,
    cssVars,
    coverEnabled: input.coverEnabled === true,
    coverImage: input.coverImage || null,
    coverPreset: def.coverPreset,
  }
}

// --- Avisos de acessibilidade ---------------------------------------------

export interface ContrastWarning {
  field: 'text' | 'accent'
  message: string
  ratio: number
}

const MIN_TEXT_CONTRAST = 4.5

/**
 * Avisos exibidos no editor. Não bloqueiam o salvamento: a decisão final de
 * cor é do dono do negócio, mas ele precisa saber quando a leitura piora.
 */
export function getContrastWarnings(theme: ResolvedBookingTheme): ContrastWarning[] {
  const warnings: ContrastWarning[] = []
  const { background, foreground, primary } = theme.colors

  const textRatio = contrastRatio(background, foreground)
  if (textRatio < MIN_TEXT_CONTRAST) {
    warnings.push({
      field: 'text',
      ratio: textRatio,
      message: 'O texto tem pouco contraste com o fundo e pode ser difícil de ler.',
    })
  }

  // Botões usam o foreground automático; o risco é o destaque se perder no fundo.
  const accentRatio = contrastRatio(background, primary)
  if (accentRatio < 1.5) {
    warnings.push({
      field: 'accent',
      ratio: accentRatio,
      message: 'A cor de destaque quase não se diferencia do fundo.',
    })
  }

  return warnings
}
