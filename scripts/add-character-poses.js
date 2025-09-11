const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'cyberjack',
  user: 'cyberjack',
  password: 'password'
});

async function addCharacterPoses() {
  try {
    console.log('🔥 Добавляем индивидуальные позы персонажам...');

    // Получаем всех персонажей
    const charactersResult = await pool.query('SELECT id, name FROM characters');
    const characters = charactersResult.rows;

    console.log(`Найдено персонажей: ${characters.length}`);

    for (const character of characters) {
      console.log(`\n📝 Добавляем позы для персонажа: ${character.name} (${character.id})`);

      // Создаем базовые позы для каждого персонажа
      const poses = {
        "standing": {
          "id": "standing",
          "name": "Стоя",
          "description": "Базовая поза стоя",
          "category": "basic",
          "key": "standing",
          "angles": [
            {
              "id": "front",
              "name": "Спереди",
              "description": "Вид спереди",
              "mediaUrl": "/images/poses/standing/front.jpg",
              "mediaType": "image",
              "activeZones": [
                {
                  "id": "face",
                  "name": "Лицо",
                  "description": "Зона лица",
                  "x": 50,
                  "y": 20,
                  "width": 20,
                  "height": 15,
                  "availableActions": ["touch", "kiss"],
                  "availableTools": ["hands"],
                  "sensitivity": 8,
                  "category": "touch"
                },
                {
                  "id": "chest",
                  "name": "Грудь",
                  "description": "Зона груди",
                  "x": 50,
                  "y": 35,
                  "width": 25,
                  "height": 20,
                  "availableActions": ["touch", "caress"],
                  "availableTools": ["hands", "rope"],
                  "sensitivity": 7,
                  "category": "touch"
                }
              ]
            }
          ],
          "requirements": {
            "flexibility": 1,
            "strength": 1
          }
        },
        "kneeling": {
          "id": "kneeling",
          "name": "На коленях",
          "description": "Поза на коленях",
          "category": "submissive",
          "key": "kneeling",
          "angles": [
            {
              "id": "front",
              "name": "Спереди",
              "description": "Вид спереди",
              "mediaUrl": "/images/poses/kneeling/front.jpg",
              "mediaType": "image",
              "activeZones": [
                {
                  "id": "face",
                  "name": "Лицо",
                  "description": "Зона лица",
                  "x": 50,
                  "y": 25,
                  "width": 20,
                  "height": 15,
                  "availableActions": ["touch", "kiss"],
                  "availableTools": ["hands"],
                  "sensitivity": 9,
                  "category": "touch"
                }
              ]
            }
          ],
          "requirements": {
            "flexibility": 2,
            "strength": 2
          }
        }
      };

      // Проверяем, есть ли уже позы для этого персонажа
      const existingResult = await pool.query(
        'SELECT id FROM character_ai_config WHERE id = $1 AND config_type = $2',
        [character.id, 'poses']
      );

      if (existingResult.rows.length > 0) {
        console.log(`  ⚠️ Позы для ${character.name} уже существуют, обновляем...`);
        await pool.query(
          'UPDATE character_ai_config SET config_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND config_type = $3',
          [JSON.stringify(poses), character.id, 'poses']
        );
      } else {
        console.log(`  ✅ Добавляем новые позы для ${character.name}...`);
        await pool.query(
          'INSERT INTO character_ai_config (id, config_type, config_data) VALUES ($1, $2, $3)',
          [character.id, 'poses', JSON.stringify(poses)]
        );
      }

      console.log(`  📊 Добавлено поз: ${Object.keys(poses).length}`);
    }

    console.log('\n🎉 Индивидуальные позы добавлены для всех персонажей!');

    // Проверяем результат
    const result = await pool.query('SELECT id, config_type FROM character_ai_config WHERE config_type = $1', ['poses']);
    console.log(`\n📈 Всего записей с позами: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Ошибка при добавлении поз:', error);
  } finally {
    await pool.end();
  }
}

addCharacterPoses();
