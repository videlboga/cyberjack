// scripts/test-pose-formulas-system.ts

import { PoseFormulaSystem } from '../lib/core/poses/pose-formula-system'

async function testPoseFormulaSystem() {
  console.log('🧮 Тестирование системы формул поз...\n')

  const poseSystem = new PoseFormulaSystem()

  // ID тестовой позы и персонажа
  const poseId = 'cmfjeu44m0007hxhpup3t6r8t'
  const characterId = 'cmfjoy4jz0001hxqgsw4ukrz1'
  const userId = 'test-user'

  try {
    console.log('1. Проверка условий позы...')
    const conditionResults = await poseSystem.checkPoseConditions(poseId, characterId, userId)
    console.log('Результаты проверки условий:', JSON.stringify(conditionResults, null, 2))

    console.log('\n2. Применение эффектов позы...')
    const effectResults = await poseSystem.applyPoseEffects(poseId, characterId, userId)
    console.log('Результаты применения эффектов:', JSON.stringify(effectResults, null, 2))

    console.log('\n3. Применение модификаторов позы...')
    const modifierResults = await poseSystem.applyPoseModifiers(poseId, 'test-action', characterId, userId)
    console.log('Результаты применения модификаторов:', JSON.stringify(modifierResults, null, 2))

    console.log('\n4. Активация позы...')
    const activationResult = await poseSystem.activatePose(poseId, characterId, userId)
    console.log('Результат активации позы:', JSON.stringify(activationResult, null, 2))

    console.log('\n✅ Все тесты выполнены успешно!')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  }
}

// Запуск тестов
testPoseFormulaSystem()
  .then(() => {
    console.log('\n🎉 Тестирование завершено!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error)
    process.exit(1)
  })
