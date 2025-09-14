import { prisma } from '@/lib/db/client'

export interface StoryPointValue {
  storyPointId: string
  value: any
  userId: string
}

export class StoryPointsManager {
  private static instance: StoryPointsManager

  static getInstance(): StoryPointsManager {
    if (!StoryPointsManager.instance) {
      StoryPointsManager.instance = new StoryPointsManager()
    }
    return StoryPointsManager.instance
  }

  // Получить значение сюжетной точки для пользователя
  async getStoryPointValue(userId: string, storyPointId: string): Promise<any> {
    try {
      // Ищем значение в базе данных
      const userStoryPoint = await prisma.userStoryPoint.findUnique({
        where: {
          userId_storyPointId: {
            userId,
            storyPointId
          }
        },
        include: {
          storyPoint: true
        }
      })

      if (userStoryPoint) {
        return userStoryPoint.value
      }

      // Если значения нет, создаем с значением по умолчанию
      const storyPoint = await prisma.storyPoint.findUnique({
        where: { id: storyPointId }
      })

      if (!storyPoint) {
        return null
      }

      const defaultValue = storyPoint.defaultValue || 0
      await this.setStoryPointValue(userId, storyPointId, defaultValue, 'default')
      return defaultValue
    } catch (error) {
      console.error('Ошибка при получении значения сюжетной точки:', error)
      return null
    }
  }

  // Установить значение сюжетной точки для пользователя
  async setStoryPointValue(
    userId: string,
    storyPointId: string,
    value: any,
    source: string = 'manual'
  ): Promise<void> {
    try {
      await prisma.userStoryPoint.upsert({
        where: {
          userId_storyPointId: {
            userId,
            storyPointId
          }
        },
        update: {
          value,
          lastUpdated: new Date(),
          source
        },
        create: {
          userId,
          storyPointId,
          value,
          source
        }
      })
    } catch (error) {
      console.error('Ошибка при установке значения сюжетной точки:', error)
      throw error
    }
  }

  // Получить все сюжетные точки пользователя
  async getUserStoryPoints(userId: string): Promise<Record<string, any>> {
    try {
      const userStoryPoints = await prisma.userStoryPoint.findMany({
        where: { userId },
        include: {
          storyPoint: true
        }
      })

      const result: Record<string, any> = {}
      for (const userStoryPoint of userStoryPoints) {
        result[userStoryPoint.storyPointId] = userStoryPoint.value
      }

      return result
    } catch (error) {
      console.error('Ошибка при получении сюжетных точек пользователя:', error)
      return {}
    }
  }

  // Проверить условие сюжетной точки
  async checkStoryPointCondition(
    userId: string,
    storyPointId: string,
    expectedValue: any
  ): Promise<boolean> {
    try {
      const currentValue = await this.getStoryPointValue(userId, storyPointId)
      return currentValue === expectedValue
    } catch (error) {
      console.error('Ошибка при проверке условия сюжетной точки:', error)
      return false
    }
  }

  // Применить последствия выбора к сюжетным точкам
  async applyChoiceConsequences(
    userId: string,
    consequences: Record<string, any>
  ): Promise<void> {
    try {
      for (const [storyPointId, newValue] of Object.entries(consequences)) {
        await this.setStoryPointValue(userId, storyPointId, newValue, 'choice')
      }
    } catch (error) {
      console.error('Ошибка при применении последствий выбора:', error)
      throw error
    }
  }

  // Сбросить все сюжетные точки пользователя
  async resetUserStoryPoints(userId: string): Promise<void> {
    try {
      await prisma.userStoryPoint.deleteMany({
        where: { userId }
      })
    } catch (error) {
      console.error('Ошибка при сбросе сюжетных точек пользователя:', error)
      throw error
    }
  }

  // Получить историю изменений сюжетной точки
  async getStoryPointHistory(userId: string, storyPointId: string): Promise<any[]> {
    try {
      const history = await prisma.userStoryPoint.findMany({
        where: {
          userId,
          storyPointId
        },
        orderBy: {
          lastUpdated: 'desc'
        }
      })

      return history
    } catch (error) {
      console.error('Ошибка при получении истории сюжетной точки:', error)
      return []
    }
  }
}
