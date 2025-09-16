// Тест с новым персонажем для проверки ИИ-триггеров

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestCharacter() {
  try {
    console.log('🧪 Создаем тестового персонажа для проверки ИИ-триггеров\n');

    // Создаем тестового персонажа
    const character = await prisma.character.create({
      data: {
        name: 'Тестовая персона',
        description: 'Персонаж для тестирования ИИ-триггеров',
        userId: 'cmfjeu4430000hxhpz4r17ol8',
        isActive: true
      }
    });

    console.log('✅ Персонаж создан:', character.id);

    // Создаем тестовое действие
    const action = await prisma.action.create({
      data: {
        name: 'Тестовое действие',
        description: 'Действие для тестирования ИИ-триггеров',
        category: 'test',
        intensity: 50,
        effects: {
          'Настроение': { change: 1, permanent: false }
        }
      }
    });

    console.log('✅ Действие создано:', action.id);

    console.log('\n📊 Данные для тестирования:');
    console.log(`Character ID: ${character.id}`);
    console.log(`Action ID: ${action.id}`);
    console.log(`User ID: cmfjeu4430000hxhpz4r17ol8`);

    return { character, action };

  } catch (error) {
    console.error('❌ Ошибка при создании тестовых данных:', error);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

createTestCharacter();
