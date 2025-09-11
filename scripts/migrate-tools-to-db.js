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

async function migrateToolsToDB() {
  try {
    console.log('🔥 Мигрируем инструменты из JSON в базу данных...');
    
    // Загружаем данные из JSON
    const gameConfigPath = path.join(process.cwd(), 'data', 'game-config-unified.json');
    const gameConfigData = JSON.parse(fs.readFileSync(gameConfigPath, 'utf8'));
    
    const tools = gameConfigData.characterAI?.tools || {};
    console.log(`Найдено инструментов в JSON: ${Object.keys(tools).length}`);
    
    for (const [toolId, toolData] of Object.entries(tools)) {
      console.log(`\n📝 Мигрируем инструмент: ${toolData.name} (${toolId})`);
      
      // Проверяем, есть ли уже такой инструмент
      const existingResult = await pool.query(
        'SELECT id FROM tools WHERE id = $1',
        [toolId]
      );
      
      if (existingResult.rows.length > 0) {
        console.log(`  ⚠️ Инструмент ${toolData.name} уже существует, обновляем...`);
        await pool.query(`
          UPDATE tools 
          SET name = $2, description = $3, category = $4, type = $5,
              base_intensity = $6, max_intensity = $7, modes = $8,
              effects = $9, requirements = $10, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [
          toolId,
          toolData.name,
          toolData.description || '',
          toolData.category || 'general',
          toolData.type || 'general',
          toolData.baseIntensity || 5,
          toolData.maxIntensity || 10,
          JSON.stringify(toolData.modes || []),
          JSON.stringify(toolData.effects || {}),
          JSON.stringify(toolData.requirements || {})
        ]);
      } else {
        console.log(`  ✅ Добавляем новый инструмент ${toolData.name}...`);
        await pool.query(`
          INSERT INTO tools (id, name, description, category, type, base_intensity, max_intensity, modes, effects, requirements)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          toolId,
          toolData.name,
          toolData.description || '',
          toolData.category || 'general',
          toolData.type || 'general',
          toolData.baseIntensity || 5,
          toolData.maxIntensity || 10,
          JSON.stringify(toolData.modes || []),
          JSON.stringify(toolData.effects || {}),
          JSON.stringify(toolData.requirements || {})
        ]);
      }
    }
    
    console.log('\n🎉 Миграция инструментов завершена!');
    
    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) FROM tools');
    console.log(`📈 Всего инструментов в БД: ${result.rows[0].count}`);
    
    // Показываем список инструментов
    const toolsResult = await pool.query('SELECT id, name, category FROM tools ORDER BY name');
    console.log('\n📋 Список инструментов в БД:');
    toolsResult.rows.forEach(tool => {
      console.log(`  - ${tool.name} (${tool.id}) - ${tool.category}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при миграции инструментов:', error);
  } finally {
    await pool.end();
  }
}

migrateToolsToDB();
