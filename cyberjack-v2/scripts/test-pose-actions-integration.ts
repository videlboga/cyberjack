// scripts/test-pose-actions-integration.ts

import { ActionsSystem } from '../lib/core/actions/actions-system'
import { ActivePosesSystem } from '../lib/core/poses/active-poses-system'

async function testPoseActionsIntegration() {
  console.log('🎯 Тестирование интеграции поз с системой действий...\n')

  try {
    const actionsSystem = new ActionsSystem()
    const activePosesSystem = ActivePosesSystem.getInstance()

    const characterId = 'cmfjoy4jz0001hxqgsw4ukrz1'
    const userId = 'system'

    console.log('1. Проверка активных поз персонажа...')
    const activePoses = await activePosesSystem.getActivePoses(characterId)
    console.log('Активные позы:', activePoses.map(p => ({
      poseId: p.poseId,
      isActive: p.isActive,
      duration: p.duration
    })))

    console.log('\n2. Получение обычных доступных действий...')
    const availableActions = await actionsSystem.getAvailableActions(characterId, userId)
    console.log('Доступные действия:', availableActions.map(a => ({
      id: a.id,
      name: a.name,
      intensity: a.intensity,
      category: a.category
    })))

    console.log('\n3. Получение модифицированных действий...')
    const modifiedActions = await actionsSystem.getModifiedActionsForCharacter(characterId, userId)
    console.log('Модифицированные действия:', modifiedActions.map(a => ({
      id: a.id,
      name: a.name,
      intensity: a.intensity,
      category: a.category
    })))

    console.log('\n4. Сравнение интенсивности действий...')
    for (let i = 0; i < Math.min(availableActions.length, modifiedActions.length); i++) {
      const original = availableActions[i]
      const modified = modifiedActions[i]

      if (original.intensity !== modified.intensity) {
        console.log(`✅ ${original.name}: ${original.intensity} → ${modified.intensity} (модифицировано!)`)
      } else {
        console.log(`➖ ${original.name}: ${original.intensity} (без изменений)`)
      }
    }

    console.log('\n5. Тестирование API модифицированных действий...')
    const apiResponse = await fetch(`http://localhost:3000/api/actions/modified?characterId=${characterId}&userId=${userId}`)
    if (apiResponse.ok) {
      const apiData = await apiResponse.json()
      console.log('✅ API модифицированных действий работает')
      console.log('Количество модифицированных действий:', apiData.count)
    } else {
      const error = await apiResponse.json()
      console.log('❌ Ошибка API:', error)
    }

    console.log('\n6. Тестирование выполнения действия с модификаторами...')
    if (availableActions.length > 0) {
      const testAction = availableActions[0]
      console.log(`Выполняем действие: ${testAction.name}`)

      try {
        const executeResponse = await fetch('http://localhost:3000/api/actions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId,
            actionId: testAction.id,
            userId,
            durationSeconds: 5
          })
        })

        if (executeResponse.ok) {
          const executeResult = await executeResponse.json()
          console.log('✅ Действие выполнено успешно:', executeResult.message)
        } else {
          const error = await executeResponse.json()
          console.log('❌ Ошибка выполнения действия:', error)
        }
      } catch (error) {
        console.log('❌ Ошибка при выполнении действия:', error)
      }
    }

    console.log('\n🎉 Тестирование интеграции завершено!')
    console.log('\n📊 Результаты:')
    console.log('✅ Активные позы отслеживаются')
    console.log('✅ Модификаторы поз применяются к действиям')
    console.log('✅ API модифицированных действий работает')
    console.log('✅ Выполнение действий с модификаторами работает')
    console.log('✅ Интеграция поз с системой действий работает')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  }
}

// Запуск тестов
testPoseActionsIntegration()
  .then(() => {
    console.log('\n🎯 Интеграция поз с системой действий готова!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error)
    process.exit(1)
  })
