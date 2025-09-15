#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPromptRendering() {
  console.log('🧪 Тестируем рендеринг промптов с переменными...')

  try {
    const character = await prisma.character.findFirst({
      where: { name: 'Линь Сюэжань' },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      console.log('❌ Персонаж не найден')
      return
    }

    console.log(`\n🎭 Тестируем промпты для ${character.name}:`)

    if (character.prompts && typeof character.prompts === 'object') {
      const prompts = character.prompts as any[]

      // Получаем текущие характеристики
      const characteristics = character.characteristics.reduce((acc, char) => {
        acc[char.definition.name] = char.currentValue
        return acc
      }, {} as Record<string, number>)

      console.log('\n📊 Текущие характеристики:')
      Object.entries(characteristics).forEach(([name, value]) => {
        console.log(`  ${name}: ${value.toFixed(2)}/10`)
      })

      // Тестируем рендеринг первого промпта
      const firstPrompt = prompts[0]
      console.log(`\n📝 Тестируем промпт: ${firstPrompt.templateName}`)
      console.log(`Шаблон: ${firstPrompt.customTemplate}`)

      // Простой рендеринг переменных
      let renderedPrompt = firstPrompt.customTemplate
      Object.entries(characteristics).forEach(([name, value]) => {
        const placeholder = `{{${name}}}`
        renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), value.toFixed(2))
      })

      console.log(`\n✅ Рендеринг результата:`)
      console.log(renderedPrompt)
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании рендеринга:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPromptRendering()
