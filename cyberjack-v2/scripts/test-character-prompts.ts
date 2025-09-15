#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { PromptSystem } from '../lib/character/prompt-system'

const prisma = new PrismaClient()

async function testCharacterPrompts() {
  console.log('🧪 Тестируем промпты персонажей...')

  try {
    const characters = await prisma.character.findMany({
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    const promptSystem = new PromptSystem()

    for (const character of characters) {
      console.log(`\n🎭 Тестируем промпты для ${character.name}:`)

      if (character.prompts && typeof character.prompts === 'object') {
        const prompts = character.prompts as any[]

        // Тестируем каждый промпт
        for (const prompt of prompts) {
          console.log(`\n  📝 ${prompt.templateId} (приоритет: ${prompt.priority}):`)
          console.log(`     Шаблон: ${prompt.customTemplate?.substring(0, 100)}...`)

          // Тестируем рендеринг промпта
          try {
            const renderedPrompt = promptSystem.renderTemplate(
              prompt.customTemplate,
              prompt.variables || {}
            )
            console.log(`     ✅ Рендеринг успешен`)
            if (typeof renderedPrompt === 'string') {
              console.log(`     Результат: ${renderedPrompt.substring(0, 80)}...`)
            } else {
              console.log(`     Результат: ${JSON.stringify(renderedPrompt).substring(0, 80)}...`)
            }
          } catch (error) {
            console.log(`     ❌ Ошибка рендеринга: ${error}`)
          }
        }

        // Тестируем общий промпт персонажа
        console.log(`\n  🎯 Общий промпт персонажа:`)
        try {
          const characterPrompts = prompts.map(p => ({
            id: p.id,
            template: p.customTemplate,
            variables: p.variables || {},
            priority: p.priority,
            isActive: p.isActive
          }))

          // Просто объединяем промпты
          const fullPrompt = characterPrompts
            .filter(p => p.isActive)
            .sort((a, b) => b.priority - a.priority)
            .map(p => p.template)
            .join('\n\n')

          console.log(`     ✅ Сборка промпта успешна`)
          console.log(`     Длина: ${fullPrompt.length} символов`)
          console.log(`     Начало: ${fullPrompt.substring(0, 100)}...`)
        } catch (error) {
          console.log(`     ❌ Ошибка сборки: ${error}`)
        }
      }
    }

    console.log('\n🎉 Тестирование завершено!')
  } catch (error) {
    console.error('❌ Ошибка при тестировании промптов:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCharacterPrompts()
