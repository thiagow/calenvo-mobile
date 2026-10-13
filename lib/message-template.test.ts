import { describe, it, expect } from 'vitest'
import {
  renderTemplate,
  findUnknownVariables,
  firstName,
  REACTIVATION_VARIABLES,
  DEFAULT_REACTIVATION_TEMPLATES,
  EXAMPLE_REACTIVATION_VARS,
} from './message-template'

describe('renderTemplate', () => {
  it('substitui todas as variáveis conhecidas', () => {
    const body = REACTIVATION_VARIABLES.map(v => `{{${v.key}}}`).join('|')
    const out = renderTemplate(body, EXAMPLE_REACTIVATION_VARS)
    expect(out).toBe(REACTIVATION_VARIABLES.map(v => v.example).join('|'))
  })

  it('tolera espaços dentro das chaves', () => {
    expect(renderTemplate('Oi {{ primeiro_nome }}!', { primeiro_nome: 'Ana' })).toBe('Oi Ana!')
  })

  it('variável sem valor vira vazio sem deixar espaço duplo', () => {
    expect(renderTemplate('Olá {{profissional}} tudo bem', {})).toBe('Olá tudo bem')
  })

  it('variável desconhecida não é tocada', () => {
    expect(renderTemplate('Oi {{nomee}}', { nome_cliente: 'Ana' })).toBe('Oi {{nomee}}')
  })
})

describe('findUnknownVariables', () => {
  it('aponta variáveis inexistentes, sem repetir', () => {
    expect(findUnknownVariables('{{nomee}} {{servico}} {{nomee}} {{data}}')).toEqual(['nomee', 'data'])
  })
  it('templates padrão só usam variáveis válidas', () => {
    for (const t of DEFAULT_REACTIVATION_TEMPLATES) expect(findUnknownVariables(t.body)).toEqual([])
  })
})

describe('firstName', () => {
  it('pega o primeiro nome e lida com espaços extras', () => {
    expect(firstName('  Ana   Maria Souza ')).toBe('Ana')
    expect(firstName('Ana')).toBe('Ana')
  })
})
