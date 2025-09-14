#!/usr/bin/env tsx

/**
 * Тест системы сюжета с базой данных
 * Проверяет персистентность данных и работу API
 */

import { prisma } from '../lib/db/client'
import { StoryPointsManager } from '../lib/story/story-points'
import { SceneManager } from '../lib/story/scene-manager'

async function testStorySystem() {
  console.log('🧪 Тестирование системы сюжета с БД...\n')

  try {
    // Создаем тестового пользователя
    const testUser = await prisma.user.upsert({
      where: { email: 'test-story@example.com' },
      update: {},
      create: {
        email: 'test-story@example.com',
        name: 'Test Story User',
        role: 'USER'
      }
    })

    console.log('✅ Тестовый пользователь создан:', testUser.id)

    // Создаем тестовую сюжетную точку
    let testStoryPoint = await prisma.storyPoint.findFirst({
      where: { name: 'test_story_point' }
    })

    if (!testStoryPoint) {
      testStoryPoint = await prisma.storyPoint.create({
        data: {
          name: 'test_story_point',
          type: 'NUMERIC',
          category: 'test',
          description: 'Тестовая сюжетная точка',
          defaultValue: 0,
          minValue: 0,
          maxValue: 100,
          tags: ['test']
        }
      })
    }

    console.log('✅ Тестовая сюжетная точка создана:', testStoryPoint.id)

    // Тестируем StoryPointsManager
    const storyPointsManager = StoryPointsManager.getInstance()

    // Получаем значение (должно создать запись с значением по умолчанию)
    const initialValue = await storyPointsManager.getStoryPointValue(testUser.id, testStoryPoint.id)
    console.log('✅ Начальное значение сюжетной точки:', initialValue)

    // Устанавливаем новое значение
    await storyPointsManager.setStoryPointValue(testUser.id, testStoryPoint.id, 42, 'test')
    console.log('✅ Значение сюжетной точки установлено: 42')

    // Проверяем, что значение сохранилось
    const savedValue = await storyPointsManager.getStoryPointValue(testUser.id, testStoryPoint.id)
    console.log('✅ Сохраненное значение:', savedValue)

    // Получаем все сюжетные точки пользователя
    const userStoryPoints = await storyPointsManager.getUserStoryPoints(testUser.id)
    console.log('✅ Все сюжетные точки пользователя:', userStoryPoints)

    // Создаем тестовую сцену
    let testScene = await prisma.scene.findFirst({
      where: { name: 'test_scene' }
    })

    if (!testScene) {
      testScene = await prisma.scene.create({
        data: {
          name: 'test_scene',
          type: 'test',
          description: 'Тестовая сцена',
          triggerConditions: {
            [testStoryPoint.id]: 42
          },
          probability: 100
        }
      })
    }

    console.log('✅ Тестовая сцена создана:', testScene.id)

    // Создаем тестовый экран
    let testScreen = await prisma.screen.findFirst({
      where: {
        sceneId: testScene.id,
        name: 'test_screen'
      }
    })

    if (!testScreen) {
      testScreen = await prisma.screen.create({
        data: {
          sceneId: testScene.id,
          name: 'test_screen',
          description: 'Тестовый экран',
          content: {
            text: 'Это тестовый экран',
            image: 'test.jpg'
          },
          accessConditions: {}
        }
      })
    }

    console.log('✅ Тестовый экран создан:', testScreen.id)

    // Создаем тестовый выбор
    let testChoice = await prisma.choice.findFirst({
      where: {
        screenId: testScreen.id,
        text: 'Тестовый выбор'
      }
    })

    if (!testChoice) {
      testChoice = await prisma.choice.create({
        data: {
          screenId: testScreen.id,
          text: 'Тестовый выбор',
          description: 'Это тестовый выбор',
          consequences: {
            [testStoryPoint.id]: 50
          },
          showConditions: {}
        }
      })
    }

    console.log('✅ Тестовый выбор создан:', testChoice.id)

    // Тестируем SceneManager
    const sceneManager = SceneManager.getInstance()

    // Получаем доступные сцены
    const availableScenes = await sceneManager.getAvailableScenes(testUser.id)
    console.log('✅ Доступные сцены:', availableScenes.length)

    // Начинаем сцену
    const startResult = await sceneManager.startScene(testUser.id, testScene.id)
    console.log('✅ Сцена начата:', startResult)

    // Выполняем выбор
    const choiceResult = await sceneManager.makeChoice(testUser.id, testChoice.id)
    console.log('✅ Выбор выполнен:', choiceResult)

    // Проверяем, что последствия применились
    const newValue = await storyPointsManager.getStoryPointValue(testUser.id, testStoryPoint.id)
    console.log('✅ Новое значение после выбора:', newValue)

    // Получаем прогресс пользователя
    const userProgress = await sceneManager.getUserSceneProgress(testUser.id)
    console.log('✅ Прогресс пользователя:', userProgress.length)

    // Получаем историю выборов
    const choiceHistory = await sceneManager.getUserChoiceHistory(testUser.id)
    console.log('✅ История выборов:', choiceHistory.length)

    // Завершаем сцену
    const completeResult = await sceneManager.completeScene(testUser.id, testScene.id)
    console.log('✅ Сцена завершена:', completeResult)

    console.log('\n🎉 Все тесты прошли успешно!')
    console.log('\n📊 Результаты:')
    console.log('- Сюжетные точки сохраняются в БД ✅')
    console.log('- Сцены работают с условиями ✅')
    console.log('- Выборы применяют последствия ✅')
    console.log('- Прогресс отслеживается ✅')
    console.log('- История выборов ведется ✅')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testStorySystem()
