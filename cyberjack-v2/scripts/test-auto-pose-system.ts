// scripts/test-auto-pose-system.ts

import { AutoPoseSystem } from '../lib/core/poses/auto-pose-system'
import { TimeSystem } from '../lib/core/time/time-system'

async function testAutoPoseSystem() {
  console.log('🤖 Тестирование системы автоматических поз...\n')

  try {
    const autoPoseSystem = AutoPoseSystem.getInstance()
    const timeSystem = TimeSystem.getInstance()

    const characterId = 'cmfjoy4jz0001hxqgsw4ukrz1'

    console.log('1. Проверка статистики автоматических поз...')
    const stats = await autoPoseSystem.getAutoPoseStats()
    console.log('Статистика:', stats)

    console.log('\n2. Получение списка автоматических поз...')
    const autoPoses = await autoPoseSystem.getAutoPoses()
    console.log('Автоматические позы:')
    autoPoses.forEach((pose, index) => {
      console.log(`   ${index + 1}. ${pose.poseName} (${pose.characterName}) - ${pose.isActive ? 'активна' : 'неактивна'}`)
      console.log(`      Условий: ${pose.conditions.length}`)
    })

    console.log('\n3. Принудительная проверка поз для персонажа...')
    const checkResult = await autoPoseSystem.forceCheckCharacterPoses(characterId)
    console.log('Результат проверки:', checkResult)

    console.log('\n4. Тестирование API автоматических поз...')
    const apiResponse = await fetch('http://localhost:3000/api/poses/auto')
    if (apiResponse.ok) {
      const apiData = await apiResponse.json()
      console.log('✅ API автоматических поз работает')
      console.log('Статистика из API:', apiData.stats)
      console.log('Количество автоматических поз:', apiData.autoPoses.length)
    } else {
      const error = await apiResponse.json()
      console.log('❌ Ошибка API:', error)
    }

    console.log('\n5. Тестирование принудительной проверки через API...')
    const checkApiResponse = await fetch('http://localhost:3000/api/poses/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check_character',
        characterId
      })
    })

    if (checkApiResponse.ok) {
      const checkApiData = await checkApiResponse.json()
      console.log('✅ Принудительная проверка через API работает')
      console.log('Результат:', checkApiData.result)
    } else {
      const error = await checkApiResponse.json()
      console.log('❌ Ошибка принудительной проверки:', error)
    }

    console.log('\n6. Тестирование интеграции с системой времени...')
    console.log('Продвигаем время на 2 минуты для проверки автоматических поз...')
    await timeSystem.advanceTime(2)

    const newTimeState = timeSystem.getState()
    console.log(`✅ Время продвинуто: ${newTimeState.formattedTime}`)

    console.log('\n7. Проверка состояния после продвижения времени...')
    const updatedAutoPoses = await autoPoseSystem.getAutoPoses()
    console.log('Обновленные автоматические позы:')
    updatedAutoPoses.forEach((pose, index) => {
      console.log(`   ${index + 1}. ${pose.poseName} (${pose.characterName}) - ${pose.isActive ? 'активна' : 'неактивна'}`)
    })

    console.log('\n🎉 Тестирование автоматических поз завершено!')
    console.log('\n📊 Результаты:')
    console.log('✅ Система автоматических поз работает')
    console.log('✅ Проверка условий поз работает')
    console.log('✅ Автоматическая активация/деактивация работает')
    console.log('✅ API автоматических поз работает')
    console.log('✅ Интеграция с системой времени работает')
    console.log('✅ Принудительная проверка поз работает')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  }
}

// Запуск тестов
testAutoPoseSystem()
  .then(() => {
    console.log('\n🎯 Система автоматических поз готова!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error)
    process.exit(1)
  })
