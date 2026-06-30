import { generateSlug } from '../lib/utils'

console.log('🔍 Verifying Slug Generation Utility\n')

const testCases = [
  { input: 'Fernanda Guimarães Studio', expected: 'fernanda-guimaraes-studio' },
  { input: 'Clínica São José', expected: 'clinica-sao-jose' },
  { input: 'Espaço Zen & Beleza', expected: 'espaco-zen-beleza' },
  { input: '  Multiple   Spaces  ', expected: 'multiple-spaces' },
  { input: 'ABC123 - Teste', expected: 'abc123-teste' },
  { input: 'Café com Açúcar', expected: 'cafe-com-acucar' },
  { input: '###Special!!!', expected: 'special' },
  { input: 'João & Maria', expected: 'joao-maria' },
  { input: '', expected: '' },
  { input: '   ', expected: '' },
]

let passed = 0
let failed = 0
const results: Array<{ test: string; input: string; expected: string; actual: string; passed: boolean }> = []

testCases.forEach(({ input, expected }, index) => {
  const result = generateSlug(input)
  const status = result === expected ? '✅' : '❌'
  
  console.log(`${status} Test ${index + 1}: "${input}"`)
  console.log(`   Expected: "${expected}"`)
  console.log(`   Got:      "${result}"`)
  
  const testResult = {
    test: `Test ${index + 1}`,
    input: input || '[empty]',
    expected,
    actual: result,
    passed: result === expected
  }
  results.push(testResult)
  
  if (result === expected) {
    passed++
  } else {
    failed++
  }
  console.log()
})

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)

if (failed === 0) {
  console.log('✅ All slug generation tests passed!')
} else {
  console.log('❌ Some slug generation tests failed!')
}

// Export results for evidence
const testLog = {
  feature: 'Slug Generation Utility',
  timestamp: new Date().toISOString(),
  tests: results,
  summary: {
    total: testCases.length,
    passed,
    failed,
    success: failed === 0
  }
}

console.log('\n📄 Test Results:', JSON.stringify(testLog, null, 2))