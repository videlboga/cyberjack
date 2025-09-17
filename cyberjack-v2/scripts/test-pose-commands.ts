// scripts/test-pose-commands.ts

import { PrismaClient } from '@prisma/client'
import { EnhancedMessageAnalyzer } from '../lib/character/enhanced-message-analyzer'

const prisma = new PrismaClient()

async function testPoseCommands() {
  console.log('🎭 Тестируем распознавание команд поз...')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst({
      include: {
        poses: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      console.log('❌ Персонажи не найдены')
      return
    }

    console.log(`👤 Тестируем с персонажем: ${character.name}`)
    console.log(`🎭 Доступные позы: ${character.poses.map(p => p.definition.name).join(', ')}`)

    const messageAnalyzer = new EnhancedMessageAnalyzer()

    // Тестовые сообщения с командами поз
    const testMessages = [
      'Встань на колени',
      'Прими позу стоя',
      'Ляг на спину',
      'Сядь красиво',
      'Раскинься на кровати',
      'Скрутись в клубок',
      'Встань прямо',
      'Присядь на корточки',
      'Ляг на живот',
      'Сядь на стул'
    ]

    console.log('\n📝 Тестируем распознавание команд поз:')
    console.log('=' .repeat(60))

    for (const message of testMessages) {
      console.log(`\n💬 Сообщение: "${message}"`)

      try {
        const analysis = await messageAnalyzer.analyzeMessage(message, character.id, 'test-user')

        if (analysis.poseCommands.length > 0) {
          console.log('✅ Найдены команды поз:')
          analysis.poseCommands.forEach(cmd => {
            console.log(`   - ${cmd.poseName} (уверенность: ${(cmd.confidence * 100).toFixed(1)}%)`)
          })
        } else {
          console.log('❌ Команды поз не найдены')
        }
      } catch (error) {
        console.log('❌ Ошибка анализа:', error.message)
      }
    }

    console.log('\n✅ Тест завершен!')
    console.log('🌐 Откройте http://localhost:3000/game для тестирования в интерфейсе')

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPoseCommands()
