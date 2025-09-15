#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'

async function testPrisma() {
  console.log('🧪 Тестируем импорт Prisma...')

  try {
    console.log('Prisma client:', prisma)
    console.log('Prisma client type:', typeof prisma)
    console.log('Prisma characteristic:', prisma.characteristic)

    const count = await prisma.characteristic.count()
    console.log(`✅ Количество характеристик: ${count}`)

  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPrisma().catch(console.error)
