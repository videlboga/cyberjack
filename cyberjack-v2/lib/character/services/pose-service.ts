import { prisma } from '../../db/client'
import { PoseCommand } from '../../../types/character-ai'
import { CharacterMemoryManager } from '../memory-manager'
import { serverLogger, LogCategory } from '../../utils/server-logger'

interface PoseServiceDeps {
  memoryManager: CharacterMemoryManager
}

export class PoseService {
  constructor(private readonly deps: PoseServiceDeps) {}

  private createPoseKey(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '_')
      .replace(/^_+|_+$/g, '')
  }

  private mapCommandToPoseName(command: string): string {
    const commandMap: Record<string, string> = {
      'лечь': 'Лежа',
      'лежать': 'Лежа',
      'ложись': 'Лежа',
      'сесть': 'Сидя',
      'сидеть': 'Сидя',
      'сядь': 'Сидя',
      'встать': 'Стоя',
      'стоять': 'Стоя',
      'встань': 'Стоя',
      'встать на колени': 'На коленях',
      'на колени': 'На коленях',
      'колени': 'На коленях',
      'встать на четвереньки': 'На четвереньках',
      'четвереньки': 'На четвереньках',
      'на четвереньки': 'На четвереньках',
      'раздеться': 'Раздетый',
      'раздеть': 'Раздетый',
      'одеться': 'Одетый',
      'одеть': 'Одетый'
    }

    const lowerCommand = command.toLowerCase().trim()

    if (commandMap[lowerCommand]) {
      return commandMap[lowerCommand]
    }

    for (const [key, value] of Object.entries(commandMap)) {
      if (lowerCommand.includes(key) || key.includes(lowerCommand)) {
        return value
      }
    }

    return command
  }

  async executePoseCommand(characterId: string, poseCommand: PoseCommand, userId: string): Promise<void> {
    try {
      const commandText = poseCommand.command || poseCommand.poseName || poseCommand.poseKey

      if (!poseCommand.poseId && !poseCommand.poseKey && !commandText) {
        serverLogger.warn(LogCategory.AI, 'Неполная команда позы', {
          characterId,
          poseCommand,
          hasCommand: !!poseCommand.command,
          hasPoseName: !!poseCommand.poseName,
          hasPoseId: !!poseCommand.poseId,
          hasPoseKey: !!poseCommand.poseKey
        })
        return
      }

      const mappedPoseName = poseCommand.poseName || (commandText ? this.mapCommandToPoseName(commandText) : undefined)

      serverLogger.info(LogCategory.AI, 'Маппинг команды позы', {
        characterId,
        poseId: poseCommand.poseId,
        poseKey: poseCommand.poseKey,
        originalCommand: poseCommand.command,
        fallbackName: mappedPoseName,
        confidence: poseCommand.confidence
      })

      let characterPose = poseCommand.poseId
        ? await prisma.characterPose.findUnique({
            where: {
              characterId_poseDefId: {
                characterId,
                poseDefId: poseCommand.poseId
              }
            },
            include: {
              definition: true,
              angles: true
            }
          })
        : null

      let cachedPoses: any[] | null = null

      const ensurePosesCache = async () => {
        if (!cachedPoses) {
          cachedPoses = (await prisma.characterPose.findMany({
            where: {
              characterId,
              isActive: true
            },
            include: {
              definition: true,
              angles: true
            }
          })) as any[]
        }
        return cachedPoses
      }

      const resolvePoseByKey = async (poseKey?: string) => {
        if (!poseKey) {
          return null
        }
        const poses = await ensurePosesCache()
        const normalizedKey = poseKey.toLowerCase()
        return poses.find(pose => this.createPoseKey(pose.definition.name) === normalizedKey) || null
      }

      const resolvePoseByName = async (name?: string) => {
        if (!name) {
          return null
        }
        const poses = await ensurePosesCache()
        const normalizedName = name.toLowerCase()
        return (
          poses.find(pose => pose.definition.name.toLowerCase() === normalizedName) ||
          poses.find(pose => pose.definition.name.toLowerCase().includes(normalizedName)) ||
          null
        )
      }

      if (!characterPose && poseCommand.poseKey) {
        characterPose = await resolvePoseByKey(poseCommand.poseKey)
      }

      if (!characterPose && mappedPoseName) {
        characterPose = await resolvePoseByName(mappedPoseName)
      }

      if (!characterPose && commandText) {
        const poses = await ensurePosesCache()
        const normalizedCommand = commandText.toLowerCase()
        characterPose =
          poses.find(pose => pose.definition.name.toLowerCase().includes(normalizedCommand)) || null
      }

      if (characterPose) {
        let targetAngle = null
        const allAngles = characterPose.angles
        for (const angle of allAngles) {
          const media = (angle.media as any) || { images: [], files: [] }
          const hasImages = media.images && media.images.length > 0
          const hasFiles = media.files && media.files.length > 0
          if (hasImages || hasFiles) {
            targetAngle = angle
            break
          }
        }

        if (targetAngle) {
          let characterCopy = await prisma.characterCopy.findFirst({
            where: {
              characterId,
              userId
            }
          })

          const poseSettings = {
            currentPose: characterPose.definition.id,
            currentAngle: targetAngle.id,
            lastPoseChange: new Date().toISOString()
          }

          if (!characterCopy) {
            characterCopy = await prisma.characterCopy.create({
              data: {
                characterId,
                userId,
                settings: poseSettings
              }
            })
          } else {
            await prisma.characterCopy.update({
              where: { id: characterCopy.id },
              data: {
                settings: {
                  ...(characterCopy.settings as Record<string, any> | null) ?? {},
                  ...poseSettings
                }
              }
            })
          }

          serverLogger.info(LogCategory.AI, 'Поза активирована', {
            characterId,
            poseId: characterPose.definition.id,
            poseName: characterPose.definition.name,
            angleId: targetAngle.id,
            angleName: targetAngle.name,
            confidence: poseCommand.confidence
          })

          await this.deps.memoryManager.addMemory(characterId, {
            type: 'POSE_CHANGE' as any,
            content: `Принята поза: ${characterPose.definition.name} (${targetAngle.name})`,
            importance: 6,
            tags: [
              'поза',
              (characterPose.definition.name || poseCommand.poseKey || commandText || 'неизвестная поза').toLowerCase()
            ],
            emotionalWeight: 4,
            context: 'команда пользователя',
            isActive: true
          })
        } else {
          serverLogger.warn(LogCategory.AI, 'У позы нет ракурсов с медиа', {
            characterId,
            poseId: characterPose.definition.id,
            poseName: characterPose.definition.name
          })
        }
      } else {
        serverLogger.warn(LogCategory.AI, 'Поза не найдена', {
          characterId,
          requestedPose: poseCommand.poseName,
          requestedPoseId: poseCommand.poseId,
          requestedPoseKey: poseCommand.poseKey,
          confidence: poseCommand.confidence
        })
      }
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при выполнении команды позы', {
        characterId,
        poseCommand,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
