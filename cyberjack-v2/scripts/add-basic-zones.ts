// scripts/add-basic-zones.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addBasicZones() {
  try {
    console.log('Добавляем базовые зоны к позам...')

    // Получаем все позы
    const poses = await prisma.poseDefinition.findMany({
      include: {
        angles: true
      }
    })

    console.log(`Найдено ${poses.length} поз`)

    for (const pose of poses) {
      console.log(`Обрабатываем позу: ${pose.name}`)

      // Если у позы нет углов, создаем базовый угол
      if (pose.angles.length === 0) {
        console.log(`  Создаем базовый угол для позы ${pose.name}`)
        
        const angle = await prisma.poseAngle.create({
          data: {
            poseDefId: pose.id,
            name: 'Основной вид',
            angle: 'default',
            media: {
              images: []
            }
          }
        })

        // Добавляем базовые зоны к углу
        const basicZones = [
          {
            name: 'Голова',
            x: 50,
            y: 20,
            width: 15,
            height: 15,
            anatomyId: null
          },
          {
            name: 'Грудь',
            x: 50,
            y: 35,
            width: 20,
            height: 20,
            anatomyId: null
          },
          {
            name: 'Живот',
            x: 50,
            y: 55,
            width: 18,
            height: 15,
            anatomyId: null
          },
          {
            name: 'Таз',
            x: 50,
            y: 70,
            width: 16,
            height: 12,
            anatomyId: null
          },
          {
            name: 'Ноги',
            x: 50,
            y: 85,
            width: 12,
            height: 10,
            anatomyId: null
          }
        ]

        for (const zoneData of basicZones) {
          await prisma.activeZone.create({
            data: {
              angleId: angle.id,
              name: zoneData.name,
              x: zoneData.x,
              y: zoneData.y,
              width: zoneData.width,
              height: zoneData.height,
              anatomyDefId: zoneData.anatomyId
            }
          })
        }

        console.log(`  Добавлено ${basicZones.length} зон к углу ${angle.name}`)
      } else {
        // Если углы есть, но у них нет зон
        for (const angle of pose.angles) {
          const zones = await prisma.activeZone.findMany({
            where: { angleId: angle.id }
          })

          if (zones.length === 0) {
            console.log(`  Добавляем зоны к углу ${angle.name}`)
            
            const basicZones = [
              {
                name: 'Голова',
                x: 50,
                y: 20,
                width: 15,
                height: 15,
                anatomyId: null
              },
              {
                name: 'Грудь',
                x: 50,
                y: 35,
                width: 20,
                height: 20,
                anatomyId: null
              },
              {
                name: 'Живот',
                x: 50,
                y: 55,
                width: 18,
                height: 15,
                anatomyId: null
              },
              {
                name: 'Таз',
                x: 50,
                y: 70,
                width: 16,
                height: 12,
                anatomyId: null
              },
              {
                name: 'Ноги',
                x: 50,
                y: 85,
                width: 12,
                height: 10,
                anatomyId: null
              }
            ]

            for (const zoneData of basicZones) {
              await prisma.activeZone.create({
                data: {
                  angleId: angle.id,
                  name: zoneData.name,
                  x: zoneData.x,
                  y: zoneData.y,
                  width: zoneData.width,
                  height: zoneData.height,
                  anatomyDefId: zoneData.anatomyId
                }
              })
            }

            console.log(`  Добавлено ${basicZones.length} зон к углу ${angle.name}`)
          }
        }
      }
    }

    console.log('Базовые зоны успешно добавлены!')
  } catch (error) {
    console.error('Ошибка при добавлении зон:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addBasicZones()
