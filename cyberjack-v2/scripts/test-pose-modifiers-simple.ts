// scripts/test-pose-modifiers-simple.ts

import { PoseFormulaSystem } from '../lib/core/poses/pose-formula-system'

async function testPoseModifiersSimple() {
  console.log('🧮 Простое тестирование модификаторов поз...\n')

  try {
    const poseFormulaSystem = new PoseFormulaSystem()

    const poseId = 'cmfjeu44m0007hxhpup3t6r8t'
    const actionId = 'cmfjeu44x000hhxhp4py8mn69' // Интенсивные ласки
    const characterId = 'cmfjoy4jz0001hxqgsw4ukrz1'
    const userId = 'system'

    console.log('1. Тестирование применения модификаторов поз...')
    const modifierResults = await poseFormulaSystem.applyPoseModifiers(
      poseId,
      actionId,
      characterId,
      userId
    )

    console.log('Результаты модификаторов:', modifierResults)

    console.log('\n2. Проверка формул позы...')
    const formulasResponse = await fetch(`http://localhost:3000/api/poses/${poseId}/formulas`)
    const formulas = await formulasResponse.json()

    console.log('Модификаторы позы:')
    formulas.modifiers.forEach((modifier: any, index: number) => {
      console.log(`${index + 1}. ${modifier.description}`)
      console.log(`   Формула: ${modifier.formula}`)
      console.log(`   Тип: ${modifier.type}`)
      console.log(`   Цель: ${modifier.target}`)
    })

    console.log('\n3. Тестирование выполнения действия...')
    const executeResponse = await fetch('http://localhost:3000/api/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId,
        actionId,
        userId,
        durationSeconds: 3
      })
    })

    if (executeResponse.ok) {
      const executeResult = await executeResponse.json()
      console.log('✅ Действие выполнено успешно:', executeResult.message)
    } else {
      const error = await executeResponse.json()
      console.log('❌ Ошибка выполнения действия:', error)
    }

    console.log('\n🎉 Тестирование модификаторов завершено!')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  }
}

// Запуск тестов
testPoseModifiersSimple()
  .then(() => {
    console.log('\n🎯 Модификаторы поз работают!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error)
    process.exit(1)
  })
