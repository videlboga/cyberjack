import { prisma } from '../../db/client'
import { CharacterAIConfig, PromptContext } from '../../../types/character-ai'
import { CharacterMemoryManager } from '../memory-manager'
import { PromptSystem } from '../prompt-system'
import { serverLogger, LogCategory } from '../../utils/server-logger'

type ConfigAccessor = () => CharacterAIConfig

type CharacterContextDeps = {
  memoryManager: CharacterMemoryManager
  promptSystem: PromptSystem
  getConfig: ConfigAccessor
}

export class CharacterContextService {
  constructor(private readonly deps: CharacterContextDeps) {}

  async getCharacterContext(
    characterId: string,
    userId: string,
    gameContext?: any
  ): Promise<PromptContext> {
    const characterCopy = await this.getCharacterCopy(characterId, userId)
    const baseCharacter = characterCopy.character
    const user = await this.getUser(userId)

    const characteristicNameMap = new Map<string, { name: string; category: string }>()

    for (const char of characterCopy.characteristics) {
      characteristicNameMap.set(char.characteristicDefId, {
        name: char.definition.name,
        category: char.definition.category
      })
    }

    const characteristics = characterCopy.characteristics.map(char => ({
      id: char.id,
      name: char.definition.name,
      category: char.definition.category,
      currentValue: char.currentValue,
      baseValue: char.baseValue,
      isRevealed: true,
      revealedValue: char.currentValue,
      accuracy: 100
    }))

    const memory = await this.deps.memoryManager.getMemoryContext(characterId)

    let poseContext: any = undefined
    const copySettings = characterCopy.settings as Record<string, any> | null

    if (typeof copySettings?.currentPose === 'string') {
      const currentPoseId = copySettings.currentPose as string
      const userPose = await prisma.characterPose.findFirst({
        where: {
          characterId,
          OR: [
            { id: currentPoseId },
            { poseDefId: currentPoseId }
          ]
        },
        include: {
          definition: true,
          angles: {
            include: {
              zones: {
                include: {
                  anatomy: true
                }
              }
            }
          }
        }
      })

      if (userPose) {
        const currentAngleId = typeof copySettings?.currentAngle === 'string' ? (copySettings.currentAngle as string) : undefined
        const currentAngle = userPose.angles.find(angle => angle.id === currentAngleId) || userPose.angles[0]

        poseContext = {
          id: userPose.id,
          name: userPose.definition.name,
          category: userPose.definition.category,
          description: userPose.definition.description,
          currentAngle: currentAngle?.name || 'default',
          activeZones: currentAngle?.zones.map(zone => ({
            id: zone.id,
            name: zone.name,
            anatomyId: zone.anatomyDefId,
            anatomyName: zone.anatomy?.name,
            sensitivity: 50,
            isActive: true
          })) || []
        }
      }
    }

    if (!poseContext) {
      serverLogger.debug(LogCategory.AI, 'Ищем активную позу персонажа', {
        characterId,
        totalPoses: baseCharacter.poses.length,
        activePoses: baseCharacter.poses.filter(pose => pose.isActive).length
      })

      let currentPose = baseCharacter.poses.find(pose => pose.isActive && pose.definition.name === 'Стоя')
      if (!currentPose) {
        currentPose = baseCharacter.poses.find(pose => pose.isActive)
      }
      if (currentPose) {
        serverLogger.debug(LogCategory.AI, 'Найдена активная поза', {
          characterId,
          poseId: currentPose.id,
          poseName: currentPose.definition.name,
          anglesCount: currentPose.angles.length
        })

        poseContext = {
          id: currentPose.id,
          name: currentPose.definition.name,
          category: currentPose.definition.category,
          description: currentPose.definition.description,
          currentAngle: currentPose.angles[0]?.name || 'default',
          activeZones: currentPose.angles[0]?.zones.map(zone => ({
            id: zone.id,
            name: zone.name,
            anatomyId: zone.anatomyDefId,
            anatomyName: zone.anatomy?.name,
            sensitivity: 50,
            isActive: true
          })) || []
        }
      } else {
        serverLogger.warn(LogCategory.AI, 'Не найдена активная поза', {
          characterId,
          totalPoses: baseCharacter.poses.length,
          poses: baseCharacter.poses.map(p => ({ id: p.id, name: p.definition.name, isActive: p.isActive }))
        })
      }
    }

    const lastAction = await this.getLastAction(characterId, userId, characteristicNameMap)
    const sessionHistory = await this.getSessionHistory(characterId, userId)

    const environment = {
      timeOfDay: 'день',
      location: 'комната',
      atmosphere: 'интимная',
      temperature: 'комфортная',
      lighting: 'приглушенная',
      sounds: ['тишина'],
      smells: ['легкий аромат']
    }

    return {
      characterId,
      userId,
      message: '',
      character: {
        id: baseCharacter.id,
        name: baseCharacter.name,
        description: baseCharacter.description || undefined,
        age: baseCharacter.age || undefined,
        avatar: baseCharacter.avatar || undefined
      },
      characteristics,
      memory,
      currentPose: poseContext,
      lastAction,
      userModifiers: (user?.modifiers as Record<string, number>) || {},
      gameTime: Date.now(),
      sessionHistory,
      environment
    }
  }

  async getCharacterContextWithDynamicPrompts(
    characterId: string,
    userId: string,
    gameContext?: any
  ): Promise<PromptContext> {
    const context = await this.getCharacterContext(characterId, userId, gameContext)

    if (this.deps.getConfig().enablePromptOptimization) {
      try {
        const avgValue =
          context.characteristics.reduce((sum, char) => sum + char.currentValue, 0) /
          context.characteristics.length

        let characteristicContext: 'high' | 'low' | 'extreme' | 'normal' = 'normal'

        if (avgValue >= 80) {
          characteristicContext = 'high'
        } else if (avgValue <= 30) {
          characteristicContext = 'low'
        } else if (avgValue >= 90 || avgValue <= 10) {
          characteristicContext = 'extreme'
        }

        await this.deps.promptSystem.createCharacteristicPrompt(characterId, characteristicContext)
        await this.deps.promptSystem.createPosePrompt(characterId)
        await this.deps.promptSystem.createCombinedPrompt(characterId, 'interaction')
      } catch (error) {
        console.warn('Ошибка при создании динамических промптов:', error)
      }
    }

    return context
  }

  private async getCharacterCopy(characterId: string, userId: string) {
    const characterCopy = await prisma.characterCopy.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId
        }
      },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        },
        character: {
          include: {
            anatomy: {
              include: {
                definition: true
              }
            },
            poses: {
              include: {
                definition: true,
                angles: {
                  include: {
                    zones: {
                      include: {
                        anatomy: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!characterCopy) {
      throw new Error('Персональная копия персонажа не найдена')
    }

    return characterCopy
  }

  private async getUser(userId: string) {
    if (!userId) return null

    return prisma.user.findUnique({
      where: { id: userId }
    })
  }

  private async getLastAction(
    characterId: string,
    userId: string,
    characteristicNameMap: Map<string, { name: string; category: string }>
  ): Promise<any> {
    try {
      const lastAction = await prisma.actionLog.findFirst({
        where: {
          characterId,
          userId
        },
        orderBy: {
          timestamp: 'desc'
        },
        include: {
          action: {
            select: {
              id: true,
              name: true,
              category: true,
              description: true
            }
          }
        }
      })

      if (!lastAction) return null

      let zoneData: any = null
      if (lastAction.zoneId) {
        try {
          const zone = await prisma.characterActiveZone.findUnique({
            where: { id: lastAction.zoneId },
            include: {
              anatomy: true
            }
          })

          if (zone) {
            zoneData = {
              id: zone.id,
              name: zone.name,
              anatomyId: zone.anatomyDefId,
              anatomyName: zone.anatomy?.name || null
            }
          }
        } catch (error) {
          console.warn('Не удалось получить информацию о зоне из ActionLog:', error)
        }
      }

      const effects = Array.isArray(lastAction.effects)
        ? (lastAction.effects as Array<{ characteristicId: string; change: number; permanent: boolean }>).map(effect => ({
            ...effect,
            characteristicName: characteristicNameMap.get(effect.characteristicId)?.name || null,
            characteristicCategory: characteristicNameMap.get(effect.characteristicId)?.category || null
          }))
        : []

      return {
        id: lastAction.id,
        actionId: lastAction.actionId,
        actionName: lastAction.action.name,
        actionCategory: lastAction.action.category,
        actionDescription: lastAction.action.description,
        intensity: lastAction.intensity,
        duration: lastAction.duration,
        timestamp: lastAction.timestamp,
        zone: zoneData,
        effects,
        success: lastAction.success
      }
    } catch (error) {
      console.error('Ошибка при получении последнего действия:', error)
      return null
    }
  }

  private async getSessionHistory(characterId: string, userId: string): Promise<any[]> {
    try {
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          characterId,
          senderId: userId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10,
        select: {
          id: true,
          content: true,
          messageType: true,
          emotionalTone: true,
          createdAt: true
        }
      })

      return recentMessages.reverse().map(msg => ({
        id: msg.id,
        content: msg.content,
        isUser: msg.messageType === 'user',
        timestamp: msg.createdAt,
        emotionalTone: msg.emotionalTone
      }))
    } catch (error) {
      console.error('Ошибка при получении истории сессии:', error)
      return []
    }
  }
}
