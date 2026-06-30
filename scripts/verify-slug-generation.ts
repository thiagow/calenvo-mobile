import { generateSlug } from '../lib/utils'

console.log('🔍 Testing Slug Generation Utility\n')

const testCases = [
  { input: 'Fernanda Guimarães Studio', expected: 'fernanda-guimaraes-studio' },
  { input: 'Clínica São José', expected: 'clinica-sao-jose' },
  { input: 'Espaço Zen & Beleza', expected: 'espaco-zen-beleza' },
  { input: '  Multiple   Spaces  ', expected: 'multiple-spaces' },
  { input: 'ABC123 - Teste', expected: 'abc123-teste' },
  { input: 'Café com Açúcar', expected: 'cafe-com-acucar' },
  { input: '###Special!!!', expected: 'special' },
  { input: 'João & Maria', expected: 'joao-maria' }
]

let passed = 0
let failed = 0

testCases.forEach(({ input, expected }) => {
  const result = generateSlug(input)
  const status = result === expected ? '✅' : '❌'
  
  console.log(`${status} Input: "${input}"`)
  console.log(`   Expected: "${expected}"`)
  console.log(`   Got:      "${result}"`)
  
  if (result === expected) {
    passed++
  } else {
    failed++
  }
  console.log()
})

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)

if (failed === 0) {
  console.log('✅ All tests passed!')
  process.exit(0)
} else {
  console.log('❌ Some tests failed!')
  process.exit(1)
}
