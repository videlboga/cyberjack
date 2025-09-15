#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCharacterPrompts() {
  console.log('🔍 Проверяем промпты персонажей...')

  try {
    const characters = await prisma.character.findMany({
      select: {
        id: true,
        name: true,
        prompts: true
      }
    })

    for (const character of characters) {
      console.log(`\n📝 ${character.name} (${character.id}):`)

      if (character.prompts && typeof character.prompts === 'object') {
        const prompts = character.prompts as any[]
        console.log(`  Количество промптов: ${prompts.length}`)

        prompts.forEach((prompt, index) => {
          console.log(`  ${index + 1}. ${prompt.templateId} (приоритет: ${prompt.priority})`)
          console.log(`     Активен: ${prompt.isActive}`)
          console.log(`     Шаблон: ${prompt.customTemplate?.substring(0, 80)}...`)
        })
      } else {
        console.log('  Промпты не найдены')
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке промптов:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCharacterPrompts()
