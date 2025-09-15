#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkFormulas() {
  console.log('🔍 Проверяем формулы в базе данных...\n')

  try {
    // Получаем все действия с формулами
    const actions = await prisma.action.findMany({
      where: {
        formula: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        formula: true
      }
    })

    console.log(`📊 Найдено действий с формулами: ${actions.length}\n`)

    for (const action of actions) {
      console.log(`🎯 Действие: ${action.name} (ID: ${action.id})`)
      console.log('📋 Формула:')
      console.log(JSON.stringify(action.formula, null, 2))

      // Проверяем структуру формулы
      if (action.formula) {
        const formula = action.formula as any

        console.log('\n🔍 Анализ структуры формулы:')
        console.log(`- Есть rootNode: ${!!formula.rootNode}`)

        if (formula.rootNode) {
          console.log(`- Тип rootNode: ${formula.rootNode.type}`)
          console.log(`- ID rootNode: ${formula.rootNode.id}`)

          // Проверяем дочерние узлы
          if (formula.rootNode.type === 'operator') {
            console.log(`- Есть leftInput: ${!!formula.rootNode.leftInput}`)
            console.log(`- Есть rightInput: ${!!formula.rootNode.rightInput}`)

            if (formula.rootNode.leftInput) {
              console.log(`  - leftInput тип: ${formula.rootNode.leftInput.type}`)
            }
            if (formula.rootNode.rightInput) {
              console.log(`  - rightInput тип: ${formula.rootNode.rightInput.type}`)
            }
          }
        } else {
          console.log('❌ ПРОБЛЕМА: rootNode отсутствует!')
        }
      }

      console.log('\n' + '='.repeat(80) + '\n')
    }

    // Также проверим действия без формул
    const actionsWithoutFormulas = await prisma.action.findMany({
      where: {
        OR: [
          { formula: null },
          { formula: {} }
        ]
      },
      select: {
        id: true,
        name: true,
        formula: true
      }
    })

    console.log(`📊 Действий без формул: ${actionsWithoutFormulas.length}`)

    if (actionsWithoutFormulas.length > 0) {
      console.log('\n🎯 Действия без формул:')
      actionsWithoutFormulas.forEach(action => {
        console.log(`- ${action.name} (ID: ${action.id})`)
      })
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке формул:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFormulas()
