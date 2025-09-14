import { prisma } from '@/lib/db/client'
import { StoryPointsManager } from './story-points'
import {
  StoryScene,
  StoryScreen,
  StoryChoice,
  StoryCondition,
  ChoiceConsequence,
  PlayerContext,
  ChoiceResult,
  SceneState
} from '@/types/screen-based-story'

export class ScreenBasedStoryManager {
  private static instance: ScreenBasedStoryManager
  private storyPointsManager: StoryPointsManager

  constructor() {
    this.storyPointsManager = StoryPointsManager.getInstance()
  }

  static getInstance(): ScreenBasedStoryManager {
    if (!ScreenBasedStoryManager.instance) {
      ScreenBasedStoryManager.instance = new ScreenBasedStoryManager()
    }
    return ScreenBasedStoryManager.instance
  }

  // Получить доступные станции для пользователя
  async getAvailableStations(userId: string): Promise<any[]> {
    try {
      const stations = await prisma.stationEntity.findMany({
        where: { isActive: true },
        include: {
          defaultScene: {
            include: {
              screens: {
                include: {
                  choices: true
                }
              }
            }
          },
          scenes: {
            where: { isActive: true },
            include: {
              screens: {
                include: {
                  choices: true
                }
              }
            }
          }
        }
      })

      const availableStations = []
      for (const station of stations) {
        // Проверяем, есть ли доступные сцены для этой станции
        const availableScenes = await this.getAvailableScenesForStation(userId, station.id)
        if (availableScenes.length > 0) {
          availableStations.push({
            ...station,
            availableScenes
          })
        }
      }

      return availableStations
    } catch (error) {
      console.error('Ошибка при получении доступных станций:', error)
      return []
    }
  }

  // Получить доступные сцены для станции
  async getAvailableScenesForStation(userId: string, stationId: string): Promise<any[]> {
    try {
      const station = await prisma.stationEntity.findUnique({
        where: { id: stationId },
        include: {
          scenes: {
            where: { isActive: true },
            include: {
              screens: {
                include: {
                  choices: true
                }
              }
            }
          }
        }
      })

      if (!station) return []

      const availableScenes = []

      // Добавляем дефолтную сцену, если она есть
      if (station.defaultScene) {
        const canActivate = await this.checkSceneConditions(userId, station.defaultScene)
        if (canActivate) {
          availableScenes.push(station.defaultScene)
        }
      }

      // Проверяем альтернативные сцены
      for (const scene of station.scenes) {
        const canActivate = await this.checkSceneConditions(userId, scene)
        if (canActivate) {
          // Проверяем вероятность
          const probability = scene.probability || 100
          if (Math.random() * 100 <= probability) {
            availableScenes.push(scene)
          }
        }
      }

      return availableScenes
    } catch (error) {
      console.error('Ошибка при получении доступных сцен для станции:', error)
      return []
    }
  }

  // Проверить условия активации сцены
  private async checkSceneConditions(userId: string, scene: any): Promise<boolean> {
    const conditions = scene.triggerConditions as StoryCondition[]

    if (!conditions || conditions.length === 0) {
      return true // Нет условий - сцена доступна
    }

    // Проверяем каждое условие
    for (const condition of conditions) {
      const conditionMet = await this.checkCondition(userId, condition)
      if (!conditionMet) {
        return false
      }
    }

    return true
  }

  // Проверить условие
  private async checkCondition(userId: string, condition: StoryCondition): Promise<boolean> {
    try {
      switch (condition.entityType) {
        case 'story_point':
          const storyPointValue = await this.storyPointsManager.getStoryPointValue(
            userId,
            condition.entityId || ''
          )
          return this.compareValues(storyPointValue, condition.operator, condition.value)

        case 'user':
          // Проверяем характеристики пользователя
          const user = await prisma.user.findUnique({
            where: { id: userId }
          })
          if (!user) return false

          const userValue = this.getNestedValue(user, condition.property)
          return this.compareValues(userValue, condition.operator, condition.value)

        case 'character':
          // Проверяем характеристики персонажа
          const characterCopy = await prisma.characterCopy.findFirst({
            where: { userId }
          })
          if (!characterCopy) return false

          const character = await prisma.character.findUnique({
            where: { id: characterCopy.characterId }
          })
          if (!character) return false

          const characterValue = this.getNestedValue(character, condition.property)
          return this.compareValues(characterValue, condition.operator, condition.value)

        default:
          return false
      }
    } catch (error) {
      console.error('Ошибка при проверке условия:', error)
      return false
    }
  }

  // Сравнить значения
  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case '==': return actual === expected
      case '!=': return actual !== expected
      case '>': return actual > expected
      case '<': return actual < expected
      case '>=': return actual >= expected
      case '<=': return actual <= expected
      default: return false
    }
  }

  // Получить вложенное значение из объекта
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  // Начать сцену для пользователя
  async startScene(userId: string, sceneId: string): Promise<SceneState | null> {
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

      if (!scene) return null

      // Проверяем условия
      const canActivate = await this.checkSceneConditions(userId, scene)
      if (!canActivate) return null

      // Определяем начальный экран
      const startScreen = scene.startScreenId
        ? scene.screens.find(s => s.id === scene.startScreenId)
        : scene.screens[0]

      if (!startScreen) return null

      // Записываем прогресс
      await prisma.userSceneProgress.upsert({
        where: {
          userId_sceneId: {
            userId,
            sceneId
          }
        },
        update: {
          status: 'IN_PROGRESS',
          currentScreenId: startScreen.id,
          startedAt: new Date()
        },
        create: {
          userId,
          sceneId,
          status: 'IN_PROGRESS',
          currentScreenId: startScreen.id,
          startedAt: new Date()
        }
      })

      // Получаем доступные выборы для начального экрана
      const availableChoices = await this.getAvailableChoices(userId, startScreen.id)

      return {
        sceneId: scene.id,
        currentScreenId: startScreen.id,
        availableChoices,
        canProceed: availableChoices.length > 0 || startScreen.isFinal,
        isComplete: false
      }
    } catch (error) {
      console.error('Ошибка при запуске сцены:', error)
      return null
    }
  }

  // Получить доступные выборы для экрана
  async getAvailableChoices(userId: string, screenId: string): Promise<StoryChoice[]> {
    try {
      const screen = await prisma.screen.findUnique({
        where: { id: screenId },
        include: {
          choices: true
        }
      })

      if (!screen) return []

      const availableChoices = []
      for (const choice of screen.choices) {
        const canShow = await this.checkChoiceConditions(userId, choice)
        if (canShow) {
          availableChoices.push({
            id: choice.id,
            text: choice.text,
            description: choice.description || undefined,
            showConditions: choice.showConditions as StoryCondition[] || [],
            nextScreenId: choice.nextScreenId || undefined,
            consequences: choice.consequences as ChoiceConsequence[] || [],
            isFinal: choice.nextScreenId === null
          })
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
    const conditions = choice.showConditions as StoryCondition[]

    if (!conditions || conditions.length === 0) {
      return true // Нет условий - выбор доступен
    }

    // Проверяем каждое условие
    for (const condition of conditions) {
      const conditionMet = await this.checkCondition(userId, condition)
      if (!conditionMet) {
        return false
      }
    }

    return true
  }

  // Выполнить выбор
  async makeChoice(userId: string, choiceId: string): Promise<ChoiceResult> {
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
        return { success: false, error: 'Выбор не найден' }
      }

      // Проверяем условия показа
      const canShow = await this.checkChoiceConditions(userId, choice)
      if (!canShow) {
        return { success: false, error: 'Условия для показа выбора не выполнены' }
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

      // Применяем последствия
      const consequences = choice.consequences as ChoiceConsequence[]
      if (consequences && consequences.length > 0) {
        await this.applyConsequences(userId, consequences)
      }

      // Обновляем прогресс сцены
      if (choice.nextScreenId) {
        await prisma.userSceneProgress.update({
          where: {
            userId_sceneId: {
              userId,
              sceneId: choice.screen.scene.id
            }
          },
          data: {
            currentScreenId: choice.nextScreenId
          }
        })
      } else {
        // Финальный выбор - завершаем сцену
        await prisma.userSceneProgress.update({
          where: {
            userId_sceneId: {
              userId,
              sceneId: choice.screen.scene.id
            }
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        })
      }

      return {
        success: true,
        nextScreenId: choice.nextScreenId || undefined,
        consequences
      }
    } catch (error) {
      console.error('Ошибка при выполнении выбора:', error)
      return { success: false, error: 'Ошибка при выполнении выбора' }
    }
  }

  // Применить последствия выбора
  private async applyConsequences(userId: string, consequences: ChoiceConsequence[]): Promise<void> {
    for (const consequence of consequences) {
      try {
        switch (consequence.type) {
          case 'change_story_point':
            if (consequence.storyPointId && consequence.storyPointChange !== undefined) {
              const currentValue = await this.storyPointsManager.getStoryPointValue(
                userId,
                consequence.storyPointId
              )
              const newValue = currentValue + consequence.storyPointChange
              await this.storyPointsManager.setStoryPointValue(
                userId,
                consequence.storyPointId,
                newValue,
                'choice'
              )
            }
            break

          case 'change_credits':
            if (consequence.creditsChange !== undefined) {
              await prisma.user.update({
                where: { id: userId },
                data: {
                  credits: {
                    increment: consequence.creditsChange
                  }
                }
              })
            }
            break

          case 'change_equipment':
            if (consequence.equipmentId && consequence.equipmentAction) {
              if (consequence.equipmentAction === 'add') {
                await prisma.userEquipment.upsert({
                  where: {
                    userId_equipmentId: {
                      userId,
                      equipmentId: consequence.equipmentId
                    }
                  },
                  update: {
                    quantity: {
                      increment: 1
                    }
                  },
                  create: {
                    userId,
                    equipmentId: consequence.equipmentId,
                    quantity: 1
                  }
                })
              } else if (consequence.equipmentAction === 'remove') {
                await prisma.userEquipment.updateMany({
                  where: {
                    userId,
                    equipmentId: consequence.equipmentId
                  },
                  data: {
                    quantity: {
                      decrement: 1
                    }
                  }
                })
              }
            }
            break

          // Добавить другие типы последствий по необходимости
        }
      } catch (error) {
        console.error('Ошибка при применении последствия:', error)
      }
    }
  }

  // Получить текущее состояние сцены для пользователя
  async getSceneState(userId: string, sceneId: string): Promise<SceneState | null> {
    try {
      const progress = await prisma.userSceneProgress.findUnique({
        where: {
          userId_sceneId: {
            userId,
            sceneId
          }
        }
      })

      if (!progress || progress.status !== 'IN_PROGRESS') {
        return null
      }

      const availableChoices = await this.getAvailableChoices(userId, progress.currentScreenId || '')

      return {
        sceneId: progress.sceneId,
        currentScreenId: progress.currentScreenId || '',
        availableChoices,
        canProceed: availableChoices.length > 0,
        isComplete: progress.status === 'COMPLETED'
      }
    } catch (error) {
      console.error('Ошибка при получении состояния сцены:', error)
      return null
    }
  }
}
