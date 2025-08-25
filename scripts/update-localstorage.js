#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Функция для чтения данных из файлов
function readFileData() {
  const dataPath = path.join(__dirname, '../data');
  
  const assets = JSON.parse(fs.readFileSync(path.join(dataPath, 'assets.json'), 'utf8'));
  const contracts = JSON.parse(fs.readFileSync(path.join(dataPath, 'contracts-unified.json'), 'utf8'));
  const actions = JSON.parse(fs.readFileSync(path.join(dataPath, 'actions-unified.json'), 'utf8'));
  const events = JSON.parse(fs.readFileSync(path.join(dataPath, 'events-unified.json'), 'utf8'));
  const market = JSON.parse(fs.readFileSync(path.join(dataPath, 'market.json'), 'utf8'));
  const equipment = JSON.parse(fs.readFileSync(path.join(dataPath, 'equipment-unified.json'), 'utf8'));
  const system = JSON.parse(fs.readFileSync(path.join(dataPath, 'system-unified.json'), 'utf8'));
  const users = JSON.parse(fs.readFileSync(path.join(dataPath, 'users-unified.json'), 'utf8'));
  
  return {
    assets,
    contracts,
    actions,
    events,
    market,
    equipment,
    system,
    users
  };
}

// Функция для создания JavaScript кода для обновления localStorage
function generateLocalStorageUpdateScript() {
  const data = readFileData();
  
  const script = `
// Скрипт для обновления localStorage из файлов
// Выполните этот код в консоли браузера

console.log('🔄 Обновляем localStorage из файлов...');

// Очищаем старые данные
localStorage.removeItem('config_assets');
localStorage.removeItem('config_contracts');
localStorage.removeItem('config_actions');
localStorage.removeItem('config_events');
localStorage.removeItem('config_market');
localStorage.removeItem('config_equipment');
localStorage.removeItem('config_system');
localStorage.removeItem('config_users');

// Обновляем данные из файлов
localStorage.setItem('config_assets', JSON.stringify(${JSON.stringify(data.assets, null, 2)}));
localStorage.setItem('config_contracts', JSON.stringify(${JSON.stringify(data.contracts, null, 2)}));
localStorage.setItem('config_actions', JSON.stringify(${JSON.stringify(data.actions, null, 2)}));
localStorage.setItem('config_events', JSON.stringify(${JSON.stringify(data.events, null, 2)}));
localStorage.setItem('config_market', JSON.stringify(${JSON.stringify(data.market, null, 2)}));
localStorage.setItem('config_equipment', JSON.stringify(${JSON.stringify(data.equipment, null, 2)}));
localStorage.setItem('config_system', JSON.stringify(${JSON.stringify(data.system, null, 2)}));
localStorage.setItem('config_users', JSON.stringify(${JSON.stringify(data.users, null, 2)}));

console.log('✅ localStorage обновлен!');
console.log('📊 Статистика:');
console.log('- Активов:', ${data.assets.assets.length});
console.log('- Контрактов:', ${data.contracts.available.length});
console.log('- Действий:', Object.keys(data.actions.categories || {}).length);
console.log('- Событий:', ${data.events.anomalies ? data.events.anomalies.length : 0});
console.log('- Пользователей:', ${data.users.users.length});

// Перезагружаем страницу для применения изменений
console.log('🔄 Перезагружаем страницу...');
setTimeout(() => window.location.reload(), 1000);
`;

  return script;
}

// Функция для создания HTML файла с инструкциями
function createUpdateInstructions() {
  const script = generateLocalStorageUpdateScript();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Обновление localStorage</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .code { background: #f5f5f5; padding: 20px; border-radius: 5px; overflow-x: auto; }
        .button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        .button:hover { background: #005a87; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔄 Обновление localStorage</h1>
        <p>Этот инструмент обновит данные в localStorage из файлов проекта.</p>
        
        <h2>Инструкция:</h2>
        <ol>
            <li>Откройте консоль браузера (F12)</li>
            <li>Скопируйте код ниже</li>
            <li>Вставьте и выполните в консоли</li>
            <li>Страница автоматически перезагрузится</li>
        </ol>
        
        <h2>Код для выполнения:</h2>
        <div class="code">
            <pre><code>${script}</code></pre>
        </div>
        
        <button class="button" onclick="copyToClipboard()">📋 Скопировать код</button>
        
        <h2>Альтернативный способ:</h2>
        <p>Или просто нажмите кнопку ниже для автоматического обновления:</p>
        <button class="button" onclick="executeUpdate()">🚀 Обновить localStorage</button>
    </div>
    
    <script>
        function copyToClipboard() {
            const code = \`${script}\`;
            navigator.clipboard.writeText(code).then(() => {
                alert('Код скопирован в буфер обмена!');
            });
        }
        
        function executeUpdate() {
            ${script}
        }
    </script>
</body>
</html>`;

  return html;
}

// Основная функция
function main() {
  console.log('🔄 Создаем инструмент для обновления localStorage...');
  
  const html = createUpdateInstructions();
  const outputPath = path.join(__dirname, '../localstorage-update.html');
  
  fs.writeFileSync(outputPath, html);
  
  console.log('✅ Создан файл localstorage-update.html');
  console.log('📁 Путь:', outputPath);
  console.log('');
  console.log('📋 Инструкция:');
  console.log('1. Откройте http://localhost:3000/localstorage-update.html');
  console.log('2. Следуйте инструкциям на странице');
  console.log('3. Или выполните код в консоли браузера на любой странице');
  console.log('');
  console.log('🔧 Альтернативно, выполните в консоли браузера:');
  console.log('localStorage.clear(); window.location.reload();');
}

main();

