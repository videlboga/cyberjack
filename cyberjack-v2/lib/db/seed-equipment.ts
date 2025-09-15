// lib/db/seed-equipment.ts - Система оборудования на базе поз

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Создаем систему оборудования...')

  // Создаем оборудование на основе заготовок из старой версии
  const equipment = [
    // Базовое оборудование
    {
      name: 'Нейронный осциллятор',
      category: 'Ручные инструменты',
      description: 'Квантовый осциллятор с нейронной синхронизацией для сенсорного тестирования',
      rarity: 'COMMON',
      cost: 200,
      requirements: { credits: 200, level: 1 }
    },
    {
      name: 'Тактильный стимулятор',
      category: 'Ручные инструменты',
      description: 'Нейротактильная перчатка с микроэлектродами для сенсорной стимуляции',
      rarity: 'COMMON',
      cost: 150,
      requirements: { credits: 150, level: 1 }
    },
    {
      name: 'Фонаторный супрессор',
      category: 'Ручные инструменты',
      description: 'Акустический супрессор с квантовыми фильтрами для вокального подавления',
      rarity: 'COMMON',
      cost: 100,
      requirements: { credits: 100, level: 1 }
    },
    {
      name: 'Электромагнитный импульсор',
      category: 'Ручные инструменты',
      description: 'Импульсный генератор с адаптивной электромагнитной модуляцией',
      rarity: 'COMMON',
      cost: 300,
      requirements: { credits: 300, level: 1 }
    },

    // Специализированное оборудование
    {
      name: 'Ректо-анализатор',
      category: 'Специализированные инструменты',
      description: 'Биометрический зонд с адаптивными сенсорами для ректо-анального исследования',
      rarity: 'UNCOMMON',
      cost: 400,
      requirements: { credits: 400, level: 2 }
    },
    {
      name: 'Клиторальный модулятор',
      category: 'Специализированные инструменты',
      description: 'Нейромодулятор с точечным воздействием для клиторальной стимуляции',
      rarity: 'COMMON',
      cost: 250,
      requirements: { credits: 250, level: 1 }
    },
    {
      name: 'Терморегулятор',
      category: 'Специализированные инструменты',
      description: 'Квантовый терморегулятор с градиентным температурным контролем',
      rarity: 'UNCOMMON',
      cost: 350,
      requirements: { credits: 350, level: 2 }
    },
    {
      name: 'Компрессионный пресс',
      category: 'Специализированные инструменты',
      description: 'Гидравлический компрессор с биометрической обратной связью',
      rarity: 'RARE',
      cost: 500,
      requirements: { credits: 500, level: 3 }
    },

    // Секс-машины
    {
      name: 'Многофункциональный вибрационный комплекс',
      category: 'Секс-машины',
      description: 'Квантовый вибрационный комплекс с нейронной синхронизацией для всесторонней стимуляции',
      rarity: 'UNCOMMON',
      cost: 3000,
      requirements: { credits: 3000, level: 2 }
    },
    {
      name: 'Ротационный анальный стимулятор',
      category: 'Секс-машины',
      description: 'Автоматизированная ротационная платформа с адаптивными анальными модулями',
      rarity: 'RARE',
      cost: 4500,
      requirements: { credits: 4500, level: 3 }
    },
    {
      name: 'Циклический клиторальный модулятор',
      category: 'Секс-машины',
      description: 'Ротационный модулятор с нейронными клиторальными стимуляторами',
      rarity: 'UNCOMMON',
      cost: 2800,
      requirements: { credits: 2800, level: 2 }
    },
    {
      name: 'Электромагнитная клетка',
      category: 'Секс-машины',
      description: 'Кондуктивная клетка с адаптивными электромагнитными импульсами',
      rarity: 'RARE',
      cost: 5500,
      requirements: { credits: 5500, level: 3 }
    },
    {
      name: 'Термодинамическая камера',
      category: 'Секс-машины',
      description: 'Изолированная термодинамическая камера с градиентными температурными полями',
      rarity: 'RARE',
      cost: 6200,
      requirements: { credits: 6200, level: 3 }
    },
    {
      name: 'Механическая тактильная клетка',
      category: 'Секс-машины',
      description: 'Автоматизированная клетка с сервомеханическими манипуляторами',
      rarity: 'UNCOMMON',
      cost: 3800,
      requirements: { credits: 3800, level: 2 }
    },

    // Экстремальное оборудование
    {
      name: 'Комбинированный сенсорный комплекс',
      category: 'Экстремальные машины',
      description: 'Интегрированный комплекс с многоуровневой сенсорной стимуляцией',
      rarity: 'EPIC',
      cost: 8500,
      requirements: { credits: 8500, level: 4 }
    },
    {
      name: 'Тензионная рама',
      category: 'Экстремальные машины',
      description: 'Автоматизированная тензионная рама с адаптивной стимуляцией',
      rarity: 'EPIC',
      cost: 7200,
      requirements: { credits: 7200, level: 4 }
    },
    {
      name: 'Групповой интерактивный комплекс',
      category: 'Экстремальные машины',
      description: 'Синхронизированная система взаимосвязанных модулей для групповых взаимодействий',
      rarity: 'LEGENDARY',
      cost: 12000,
      requirements: { credits: 12000, level: 5 }
    },

    // Интерактивные сексуальные инструменты
    {
      name: 'Кибернетический партнер "Синтезатор"',
      category: 'Интерактивные сексуальные',
      description: 'Адаптивный кибернетический партнер с ИИ-анализом реакций',
      rarity: 'RARE',
      cost: 1800,
      requirements: { credits: 1800, level: 3 }
    },
    {
      name: 'Виртуальный гарем "Квантовый бордель"',
      category: 'Интерактивные сексуальные',
      description: 'Иммерсивная VR-система с бесконечным количеством виртуальных партнеров',
      rarity: 'EPIC',
      cost: 2500,
      requirements: { credits: 2500, level: 4 }
    },
    {
      name: 'Сенсорный лабиринт "Лабиринт удовольствий"',
      category: 'Интерактивные сексуальные',
      description: 'Интерактивный лабиринт где стены и потолок оживают',
      rarity: 'LEGENDARY',
      cost: 3200,
      requirements: { credits: 3200, level: 5 }
    },
    {
      name: 'Групповой симулятор "Синхронный узел"',
      category: 'Интерактивные сексуальные',
      description: 'Синхронизированная система где все участники чувствуют ощущения друг друга',
      rarity: 'EPIC',
      cost: 2800,
      requirements: { credits: 2800, level: 4 }
    },
    {
      name: 'Адаптивный доминатор "Алгоритм власти"',
      category: 'Интерактивные сексуальные',
      description: 'ИИ-система анализирует реакции и автоматически переключается между доминированием и подчинением',
      rarity: 'EPIC',
      cost: 3500,
      requirements: { credits: 3500, level: 4 }
    },
    {
      name: 'Биомеханический симбионт "Симбиозатор"',
      category: 'Интерактивные сексуальные',
      description: 'Биомеханический организм который сливается с телом актива',
      rarity: 'LEGENDARY',
      cost: 4200,
      requirements: { credits: 4200, level: 5 }
    }
  ]

  // Создаем оборудование
  const createdEquipment = []
  for (const item of equipment) {
    const equipmentItem = await prisma.equipment.create({
      data: item
    })
    createdEquipment.push(equipmentItem)
  }

  console.log(`✅ Создано оборудования: ${createdEquipment.length}`)

  // Создаем связи оборудования с позами
  console.log('🔗 Создаем связи оборудования с позами...')

  // Получаем все позы
  const poses = await prisma.poseDefinition.findMany()

  // Создаем связи между оборудованием и позами
  const equipmentPoseRelations = [
    // Базовые позы доступны всем
    { equipmentName: 'Нейронный осциллятор', poseNames: ['Стоя', 'Лежа', 'Сидя'] },
    { equipmentName: 'Тактильный стимулятор', poseNames: ['Стоя', 'Лежа', 'Сидя'] },
    { equipmentName: 'Фонаторный супрессор', poseNames: ['Стоя', 'Лежа', 'Сидя'] },
    { equipmentName: 'Электромагнитный импульсор', poseNames: ['Стоя', 'Лежа', 'Сидя'] },

    // Специализированное оборудование требует определенных поз
    { equipmentName: 'Ректо-анализатор', poseNames: ['На коленях', 'Стоя на четвереньках', 'Лежа на животе'] },
    { equipmentName: 'Клиторальный модулятор', poseNames: ['Лежа на спине', 'Стоя с поднятыми руками'] },
    { equipmentName: 'Терморегулятор', poseNames: ['Лежа', 'Стоя', 'Сидя'] },
    { equipmentName: 'Компрессионный пресс', poseNames: ['Стоя', 'Лежа на спине'] },

    // Секс-машины требуют специальных поз
    { equipmentName: 'Многофункциональный вибрационный комплекс', poseNames: ['Лежа на спине', 'Лежа на животе'] },
    { equipmentName: 'Ротационный анальный стимулятор', poseNames: ['Стоя на четвереньках', 'Лежа на животе'] },
    { equipmentName: 'Циклический клиторальный модулятор', poseNames: ['Лежа на спине', 'Стоя с поднятыми руками'] },
    { equipmentName: 'Электромагнитная клетка', poseNames: ['Стоя', 'На коленях'] },
    { equipmentName: 'Термодинамическая камера', poseNames: ['Лежа', 'Стоя'] },
    { equipmentName: 'Механическая тактильная клетка', poseNames: ['Стоя', 'На коленях', 'Стоя на четвереньках'] },

    // Экстремальное оборудование
    { equipmentName: 'Комбинированный сенсорный комплекс', poseNames: ['Лежа на спине', 'Лежа на животе', 'Стоя на четвереньках'] },
    { equipmentName: 'Тензионная рама', poseNames: ['Стоя с поднятыми руками', 'Стоя на четвереньках'] },
    { equipmentName: 'Групповой интерактивный комплекс', poseNames: ['Стоя', 'Лежа', 'На коленях', 'Стоя на четвереньках'] },

    // Интерактивные сексуальные инструменты
    { equipmentName: 'Кибернетический партнер "Синтезатор"', poseNames: ['Лежа на спине', 'Лежа на животе'] },
    { equipmentName: 'Виртуальный гарем "Квантовый бордель"', poseNames: ['Лежа', 'Сидя'] },
    { equipmentName: 'Сенсорный лабиринт "Лабиринт удовольствий"', poseNames: ['Стоя', 'Стоя на четвереньках'] },
    { equipmentName: 'Групповой симулятор "Синхронный узел"', poseNames: ['Лежа', 'Стоя', 'На коленях'] },
    { equipmentName: 'Адаптивный доминатор "Алгоритм власти"', poseNames: ['Стоя', 'На коленях', 'Стоя на четвереньках'] },
    { equipmentName: 'Биомеханический симбионт "Симбиозатор"', poseNames: ['Лежа на спине', 'Лежа на животе'] }
  ]

  for (const relation of equipmentPoseRelations) {
    const equipment = createdEquipment.find(e => e.name === relation.equipmentName)
    if (!equipment) continue

    for (const poseName of relation.poseNames) {
      const pose = poses.find(p => p.name === poseName)
      if (!pose) continue

      // Обновляем позу, добавляя связь с оборудованием
      await prisma.poseDefinition.update({
        where: { id: pose.id },
        data: {
          relatedEquipment: {
            connect: { id: equipment.id }
          }
        }
      })
    }
  }

  console.log(`✅ Создано связей оборудования с позами: ${equipmentPoseRelations.length}`)

  // Создаем оборудование для тестового пользователя
  console.log('👤 Создаем оборудование для тестового пользователя...')

  const testUser = await prisma.user.findFirst({
    where: { email: 'user@cyberjack.local' }
  })

  if (testUser) {
    // Даем пользователю базовое оборудование
    const basicEquipment = createdEquipment.filter(e => e.rarity === 'COMMON').slice(0, 3)

    for (const item of basicEquipment) {
      await prisma.userEquipment.create({
        data: {
          userId: testUser.id,
          equipmentId: item.id,
          quantity: 1,
          settings: {
            condition: 'excellent',
            lastUsed: null,
            customizations: {}
          }
        }
      })
    }

    console.log(`✅ Создано оборудования для пользователя: ${basicEquipment.length}`)
  }

  console.log('')
  console.log('🎉 СИСТЕМА ОБОРУДОВАНИЯ СОЗДАНА!')
  console.log('')
  console.log('📊 Создано:')
  console.log(`   🔧 Единиц оборудования: ${createdEquipment.length}`)
  console.log(`   🔗 Связей с позами: ${equipmentPoseRelations.length}`)
  console.log(`   👤 Оборудования у пользователя: ${testUser ? 3 : 0}`)
  console.log('')
  console.log('🚀 Система оборудования готова к использованию!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при создании системы оборудования:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
