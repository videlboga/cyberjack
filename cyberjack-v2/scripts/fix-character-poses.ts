// scripts/fix-character-poses.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixCharacterPoses() {
  try {
    console.log('Исправляем позы персонажей...')

    // Получаем всех персонажей с их позами
    const characters = await prisma.character.findMany({
      include: {
        poses: {
          include: {
            definition: {
              include: {
                angles: {
                  include: {
                    zones: true
                  }
                }
              }
            },
            angles: true
          }
        }
      }
    })

    for (const character of characters) {
      console.log(`Обрабатываем персонажа: ${character.name}`)

      for (const characterPose of character.poses) {
        console.log(`  Поза: ${characterPose.definition.name}`)

        // Если у копии позы нет углов, создаем их на основе определения
        if (characterPose.angles.length === 0 && characterPose.definition.angles.length > 0) {
          console.log(`    Создаем углы для позы ${characterPose.definition.name}`)

          for (const definitionAngle of characterPose.definition.angles) {
            // Создаем угол для копии позы
            const characterAngle = await prisma.characterPoseAngle.create({
              data: {
                characterPoseId: characterPose.id,
                name: definitionAngle.name,
                description: `Ракурс ${definitionAngle.angle}`,
                media: definitionAngle.media
              }
            })

            // Создаем зоны для угла
            for (const zone of definitionAngle.zones) {
              await prisma.characterActiveZone.create({
                data: {
                  characterAngleId: characterAngle.id,
                  name: zone.name,
                  x: zone.x,
                  y: zone.y,
                  width: zone.width,
                  height: zone.height,
                  anatomyDefId: zone.anatomyDefId
                }
              })
            }

            console.log(`    Создан угол ${characterAngle.name} с ${definitionAngle.zones.length} зонами`)
          }
        }
      }
    }

    console.log('Позы персонажей успешно исправлены!')
  } catch (error) {
    console.error('Ошибка при исправлении поз:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixCharacterPoses()
