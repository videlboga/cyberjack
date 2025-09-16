// Скрипт для проверки количества применений действия

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkActionCount() {
  try {
    const characterId = 'cmfkv6rlo0002hxtm7atmgy6r';
    const actionId = 'cmfku3qu1000dhxv7w7bqoe3x';

    console.log('🔍 Проверяем количество применений действия\n');
    console.log(`Character ID: ${characterId}`);
    console.log(`Action ID: ${actionId}\n`);

    // Подсчитываем количество применений
    const count = await prisma.actionLog.count({
      where: {
        characterId,
        actionId
      }
    });

    console.log(`📊 Количество применений: ${count}`);

    // Получаем последние записи
    const recentActions = await prisma.actionLog.findMany({
      where: {
        characterId,
        actionId
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 5,
      include: {
        action: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('\n📋 Последние применения:');
    recentActions.forEach((action, index) => {
      console.log(`${index + 1}. ${action.action.name} - ${action.timestamp.toISOString()}`);
      console.log(`   Интенсивность: ${action.intensity}, Длительность: ${action.duration}с`);
      console.log(`   Zone ID: ${action.zoneId || 'не указан'}`);
    });

    // Проверяем логику триггера
    const shouldTrigger = count === 2 || (count >= 10 && count % 10 === 0);
    console.log(`\n🎯 Должен ли триггерить ИИ: ${shouldTrigger ? 'ДА' : 'НЕТ'}`);

    if (count < 2) {
      console.log(`⏭️  Следующий триггер: 2-е применение (через ${2 - count} применений)`);
    } else if (count < 10) {
      console.log(`⏭️  Следующий триггер: 10-е применение (через ${10 - count} применений)`);
    } else {
      const nextTrigger = Math.ceil(count / 10) * 10;
      console.log(`⏭️  Следующий триггер: ${nextTrigger}-е применение (через ${nextTrigger - count} применений)`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActionCount();
