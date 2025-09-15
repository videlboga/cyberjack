// scripts/fix-zone-coordinates.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixZoneCoordinates() {
  try {
    console.log('Исправляем координаты зон...')

    // Получаем все персонализированные зоны (простой запрос)
    const characterZones = await prisma.characterActiveZone.findMany()
    console.log(`Найдено ${characterZones.length} персонализированных зон`)

    for (const zone of characterZones) {
      console.log(`Проверяем зону: ${zone.name} (x=${zone.x}, y=${zone.y}, w=${zone.width}, h=${zone.height})`)
      
      // Если координаты больше 100, значит они в пикселях - конвертируем в проценты
      if (zone.x > 100 || zone.y > 100 || zone.width > 100 || zone.height > 100) {
        console.log(`  Конвертируем из пикселей в проценты...`)
        
        // Предполагаем стандартный размер изображения 800x600
        const imageWidth = 800
        const imageHeight = 600
        
        const newX = (zone.x / imageWidth) * 100
        const newY = (zone.y / imageHeight) * 100
        const newWidth = (zone.width / imageWidth) * 100
        const newHeight = (zone.height / imageHeight) * 100
        
        console.log(`  Было: x=${zone.x}, y=${zone.y}, w=${zone.width}, h=${zone.height}`)
        console.log(`  Стало: x=${newX.toFixed(2)}, y=${newY.toFixed(2)}, w=${newWidth.toFixed(2)}, h=${newHeight.toFixed(2)}`)
        
        // Обновляем координаты
        await prisma.characterActiveZone.update({
          where: { id: zone.id },
          data: {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
          }
        })
        
        console.log(`  ✅ Зона ${zone.name} обновлена`)
      } else {
        console.log(`  Зона ${zone.name} уже в процентах, пропускаем`)
      }
    }

    console.log('Координаты зон успешно исправлены!')
  } catch (error) {
    console.error('Ошибка при исправлении координат зон:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixZoneCoordinates()
