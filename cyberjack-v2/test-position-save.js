#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки сохранения позиций экранов в графе
 */

const BASE_URL = 'http://localhost:3000'

async function testPositionSave() {
  console.log('🧪 Тестирование сохранения позиций экранов...\n')

  try {
    // 1. Получаем все сцены
    console.log('1. Получаем список сцен...')
    const scenesResponse = await fetch(`${BASE_URL}/api/story/scenes`)
    if (!scenesResponse.ok) {
      throw new Error(`Ошибка получения сцен: ${scenesResponse.status}`)
    }
    const scenes = await scenesResponse.json()
    console.log(`   Найдено сцен: ${scenes.length}`)

    if (scenes.length === 0) {
      console.log('   ❌ Нет сцен для тестирования')
      return
    }

    // 2. Выбираем первую сцену
    const testScene = scenes[0]
    console.log(`   Выбрана сцена: "${testScene.name}" (ID: ${testScene.id})`)

    // 3. Получаем экраны сцены
    console.log('\n2. Получаем экраны сцены...')
    const screensResponse = await fetch(`${BASE_URL}/api/story/scenes/${testScene.id}/screens`)
    if (!screensResponse.ok) {
      throw new Error(`Ошибка получения экранов: ${screensResponse.status}`)
    }
    const screens = await screensResponse.json()
    console.log(`   Найдено экранов: ${screens.length}`)

    if (screens.length === 0) {
      console.log('   ❌ Нет экранов для тестирования')
      return
    }

    // 4. Тестируем сохранение позиций для каждого экрана
    console.log('\n3. Тестируем сохранение позиций...')

    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i]
      const newPosition = {
        x: Math.random() * 800 + 100,
        y: Math.random() * 600 + 100
      }

      console.log(`   Экран "${screen.name}" (ID: ${screen.id}):`)
      console.log(`     Старая позиция: ${JSON.stringify(screen.position)}`)
      console.log(`     Новая позиция: ${JSON.stringify(newPosition)}`)

      // Обновляем позицию
      const updateResponse = await fetch(`${BASE_URL}/api/story/screens/${screen.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position: newPosition
        }),
      })

      if (!updateResponse.ok) {
        throw new Error(`Ошибка обновления экрана ${screen.id}: ${updateResponse.status}`)
      }

      const updatedScreen = await updateResponse.json()
      console.log(`     ✅ Позиция обновлена: ${JSON.stringify(updatedScreen.position)}`)

      // Проверяем, что позиция действительно сохранилась
      const verifyResponse = await fetch(`${BASE_URL}/api/story/screens/${screen.id}`)
      if (!verifyResponse.ok) {
        throw new Error(`Ошибка проверки экрана ${screen.id}: ${verifyResponse.status}`)
      }

      const verifiedScreen = await verifyResponse.json()
      const positionMatches =
        Math.abs(verifiedScreen.position.x - newPosition.x) < 0.1 &&
        Math.abs(verifiedScreen.position.y - newPosition.y) < 0.1

      if (positionMatches) {
        console.log(`     ✅ Позиция корректно сохранена в БД`)
      } else {
        console.log(`     ❌ Позиция НЕ сохранена! Ожидалось: ${JSON.stringify(newPosition)}, получено: ${JSON.stringify(verifiedScreen.position)}`)
      }

      console.log('')
    }

    console.log('🎉 Тестирование завершено успешно!')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message)
    process.exit(1)
  }
}

// Запускаем тест
testPositionSave()
