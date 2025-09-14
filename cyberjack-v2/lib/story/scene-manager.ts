import { prisma } from '@/lib/db/client'
import { StoryPointsManager } from './story-points'

export interface SceneContext {
  userId: string
  currentSceneId?: string
  currentScreenId?: string
}

export class SceneManager {
  private static instance: SceneManager
  private storyPointsManager: StoryPointsManager

  constructor() {
    this.storyPointsManager = StoryPointsManager.getInstance()
  }

  static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager()
    }
    return SceneManager.instance
  }

  // Получить доступные сцены для пользователя
  async getAvailableScenes(userId: string): Promise<any[]> {
    try {
      const scenes = await prisma.scene.findMany({
        where: { isActive: true },
        include: {
          screens: {
            include: {
              choices: true
            }
          }
        }
      })

      const availableScenes = []
      for (const scene of scenes) {
        const canActivate = await this.checkSceneConditions(userId, scene)
        if (canActivate) {
          availableScenes.push(scene)
        }
      }

      return availableScenes
    } catch (error) {
      console.error('Ошибка при получении доступных сцен:', error)
      return []
    }
  }

  // Проверить условия активации сцены
  private async checkSceneConditions(userId: string, scene: any): Promise<boolean> {
    const conditions = scene.triggerConditions as Record<string, any>

    if (!conditions || Object.keys(conditions).length === 0) {
      return true // Нет условий - сцена доступна
    }

    // Проверяем каждое условие
    for (const [storyPointId, expectedValue] of Object.entries(conditions)) {
      const conditionMet = await this.storyPointsManager.checkStoryPointCondition(
        userId,
        storyPointId,
        expectedValue
      )

      if (!conditionMet) {
        return false
      }
    }

    return true
  }

  // Получить доступные экраны для сцены
  async getAvailableScreens(userId: string, sceneId: string): Promise<any[]> {
    try {
      const screens = await prisma.screen.findMany({
        where: { sceneId },
        include: {
          choices: true
        }
      })

      const availableScreens = []
      for (const screen of screens) {
        const canAccess = await this.checkScreenAccess(userId, screen)
        if (canAccess) {
          availableScreens.push(screen)
        }
      }

      return availableScreens
    } catch (error) {
      console.error('Ошибка при получении доступных экранов:', error)
      return []
    }
  }

  // Проверить условия доступа к экрану
  private async checkScreenAccess(userId: string, screen: any): Promise<boolean> {
    const conditions = screen.accessConditions as Record<string, any>

    if (!conditions || Object.keys(conditions).length === 0) {
      return true // Нет условий - экран доступен
    }

    // Проверяем каждое условие
    for (const [storyPointId, expectedValue] of Object.entries(conditions)) {
      const conditionMet = await this.storyPointsManager.checkStoryPointCondition(
        userId,
        storyPointId,
        expectedValue
      )

      if (!conditionMet) {
        return false
      }
    }

    return true
  }

  // Получить доступные выборы для экрана
  async getAvailableChoices(userId: string, screenId: string): Promise<any[]> {
    try {
      const choices = await prisma.choice.findMany({
        where: { screenId }
      })

      const availableChoices = []
      for (const choice of choices) {
        const canShow = await this.checkChoiceConditions(userId, choice)
        if (canShow) {
          availableChoices.push(choice)
        }
      }

      return availableChoices
    } catch (error) {
      console.error('Ошибка при получении доступных выборов:', error)
      return []
    }
  }

  // Проверить условия показа выбора
  private async checkChoiceConditions(userId: string, choice: any): Promise<boolean> {
    const conditions = choice.showConditions as Record<string, any>

    if (!conditions || Object.keys(conditions).length === 0) {
      return true // Нет условий - выбор доступен
    }

    // Проверяем каждое условие
    for (const [storyPointId, expectedValue] of Object.entries(conditions)) {
      const conditionMet = await this.storyPointsManager.checkStoryPointCondition(
        userId,
        storyPointId,
        expectedValue
      )

      if (!conditionMet) {
        return false
      }
    }

    return true
  }

  // Выполнить выбор
  async makeChoice(userId: string, choiceId: string): Promise<boolean> {
    try {
      const choice = await prisma.choice.findUnique({
        where: { id: choiceId },
        include: {
          screen: {
            include: {
              scene: true
            }
          }
        }
      })

      if (!choice) {
        return false
      }

      // Проверяем условия показа
      const canShow = await this.checkChoiceConditions(userId, choice)
      if (!canShow) {
        return false
      }

      // Записываем выбор в историю
      await prisma.userChoiceHistory.create({
        data: {
          userId,
          choiceId,
          sceneId: choice.screen.scene.id,
          screenId: choice.screen.id,
          context: {
            timestamp: new Date(),
            choiceText: choice.text
          }
        }
      })

      // Применяем последствия выбора
      const consequences = choice.consequences as Record<string, any>
      if (consequences && Object.keys(consequences).length > 0) {
        await this.storyPointsManager.applyChoiceConsequences(userId, consequences)
      }

      return true
    } catch (error) {
      console.error('Ошибка при выполнении выбора:', error)
      return false
    }
  }

  // Получить полный контекст сцены для пользователя
  async getSceneContext(userId: string, sceneId: string): Promise<any> {
    try {
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          screens: {
            include: {
              choices: true
            }
          }
        }
      })

      if (!scene) {
        return null
      }

      const availableScreens = await this.getAvailableScreens(userId, sceneId)
      const userStoryPoints = await this.storyPointsManager.getUserStoryPoints(userId)

      return {
        scene,
        availableScreens,
        userStoryPoints
      }
    } catch (error) {
      console.error('Ошибка при получении контекста сцены:', error)
      return null
    }
  }

  // Начать сцену для пользователя
  async startScene(userId: string, sceneId: string): Promise<boolean> {
    try {
      await prisma.userSceneProgress.upsert({
        where: {
          userId_sceneId: {
            userId,
            sceneId
          }
        },
        update: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        },
        create: {
          userId,
          sceneId,
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      })

      return true
    } catch (error) {
      console.error('Ошибка при запуске сцены:', error)
      return false
    }
  }

  // Завершить сцену для пользователя
  async completeScene(userId: string, sceneId: string): Promise<boolean> {
    try {
      await prisma.userSceneProgress.update({
        where: {
          userId_sceneId: {
            userId,
            sceneId
          }
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      return true
    } catch (error) {
      console.error('Ошибка при завершении сцены:', error)
      return false
    }
  }

  // Получить прогресс пользователя по сценам
  async getUserSceneProgress(userId: string): Promise<any[]> {
    try {
      const progress = await prisma.userSceneProgress.findMany({
        where: { userId },
        include: {
          scene: true
        },
        orderBy: {
          startedAt: 'desc'
        }
      })

      return progress
    } catch (error) {
      console.error('Ошибка при получении прогресса сцен:', error)
      return []
    }
  }

  // Получить историю выборов пользователя
  async getUserChoiceHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const history = await prisma.userChoiceHistory.findMany({
        where: { userId },
        include: {
          choice: true,
          scene: true,
          screen: true
        },
        orderBy: {
          chosenAt: 'desc'
        },
        take: limit
      })

      return history
    } catch (error) {
      console.error('Ошибка при получении истории выборов:', error)
      return []
    }
  }
}
