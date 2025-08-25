#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Функция для чтения данных из localStorage (имитация)
function getLocalStorageData() {
  // В реальности это должно быть получено из браузера
  // Пока что создадим тестовые данные
  return {
    assets: [
      {
        "id": "asset_1",
        "name": "Алекс",
        "rank": "Junior",
        "avatar": "👩‍💻",
        "price": 150,
        "specialization": "Базовое подчинение",
        "description": "Молодая актив с хорошими навыками обслуживания",
        "status": "available",
        "owner": null,
        "location": "talent_exchange",
        "attributes": {
          "strength": 2,
          "empathy": 3,
          "intelligence": 4,
          "temperament": 3,
          "grit": 3,
          "ego": 2,
          "loyalty": 1,
          "obedience": 2,
          "resistance": 1
        },
        "skills": {
          "maid": 2,
          "cooking": 1,
          "neural_hacking": 4,
          "orgasm_control": 3,
          "field": 2,
          "etiquette": 2,
          "logistics": 2,
          "medical": 1,
          "maintenance": 3,
          "data": 3,
          "dance": 1,
          "seduction": 2,
          "interrogation": 1,
          "surveillance": 2
        },
        "traits": ["loyal", "quick_learner", "tech_savvy"],
        "preferences": {
          "work_type": ["service", "technical"],
          "environment": ["clean", "quiet"],
          "avoid": ["violence", "chaos"]
        },
        "condition": {
          "health": 100,
          "mental_state": 85,
          "stress": 15,
          "fatigue": 20
        },
        "history": {
          "created": "2024-01-15",
          "last_training": "2024-01-20",
          "assignments": 3,
          "success_rate": 0.85
        }
      },
      {
        "id": "asset_2",
        "name": "Мария",
        "rank": "Middle",
        "avatar": "👩‍💼",
        "price": 300,
        "specialization": "Этикет и подчинение",
        "description": "Опытная актив с отличными навыками обслуживания",
        "status": "available",
        "owner": null,
        "location": "talent_exchange",
        "attributes": {
          "strength": 3,
          "empathy": 5,
          "intelligence": 3,
          "temperament": 4,
          "grit": 4,
          "ego": 2,
          "loyalty": 3,
          "obedience": 4,
          "resistance": 2
        },
        "skills": {
          "maid": 4,
          "cooking": 5,
          "neural_hacking": 2,
          "orgasm_control": 2,
          "field": 3,
          "etiquette": 5,
          "logistics": 3,
          "medical": 2,
          "maintenance": 1,
          "data": 2,
          "dance": 4,
          "seduction": 4,
          "interrogation": 2,
          "surveillance": 1
        },
        "traits": ["elegant", "experienced", "loyal"],
        "preferences": {
          "work_type": ["service", "luxury"],
          "environment": ["clean", "elegant"],
          "avoid": ["rough", "chaos"]
        },
        "condition": {
          "health": 95,
          "mental_state": 90,
          "stress": 10,
          "fatigue": 15
        },
        "history": {
          "created": "2024-01-10",
          "last_training": "2024-01-18",
          "assignments": 8,
          "success_rate": 0.92
        }
      },
      {
        "id": "asset_3",
        "name": "Виктория",
        "rank": "Senior",
        "avatar": "👩‍🔬",
        "price": 500,
        "specialization": "Нейротехнологии",
        "description": "Элитная актив с продвинутыми навыками нейрохакерства",
        "status": "available",
        "owner": null,
        "location": "talent_exchange",
        "attributes": {
          "strength": 2,
          "empathy": 4,
          "intelligence": 6,
          "temperament": 3,
          "grit": 5,
          "ego": 3,
          "loyalty": 4,
          "obedience": 5,
          "resistance": 3
        },
        "skills": {
          "maid": 3,
          "cooking": 2,
          "neural_hacking": 6,
          "orgasm_control": 5,
          "field": 4,
          "etiquette": 3,
          "logistics": 4,
          "medical": 3,
          "maintenance": 4,
          "data": 6,
          "dance": 2,
          "seduction": 3,
          "interrogation": 4,
          "surveillance": 5
        },
        "traits": ["intelligent", "tech_expert", "analytical"],
        "preferences": {
          "work_type": ["technical", "research"],
          "environment": ["clean", "organized"],
          "avoid": ["chaos", "violence"]
        },
        "condition": {
          "health": 90,
          "mental_state": 95,
          "stress": 5,
          "fatigue": 10
        },
        "history": {
          "created": "2024-01-05",
          "last_training": "2024-01-15",
          "assignments": 12,
          "success_rate": 0.95
        }
      }
    ],
    contracts: [
      {
        "id": "ctr_001",
        "client": "SlaveTech Inc.",
        "title": "Тренировка актива с имплантом контроля оргазмов",
        "description": "Требуется подготовка актива с имплантированным чипом контроля оргазмов для корпоративного клиента.",
        "requirements": {
          "skills": { "orgasm_control": 3, "neural_hacking": 2 },
          "minRank": "C"
        },
        "reward": 800,
        "deadline": 5,
        "kpi": [
          { "name": "Подчинение", "weight": 0.6, "current": 0, "target": 100 },
          { "name": "Контроль", "weight": 0.4, "current": 0, "target": 100 }
        ],
        "assignedTalents": [],
        "status": "available",
        "storyScenes": {
          "onAccept": ["contract_briefing", "implant_intro"],
          "onProgress": ["training_challenge", "implant_glitch"],
          "onComplete": ["client_demo", "client_feedback"],
          "onFail": ["implant_failure", "deadline_missed"]
        }
      },
      {
        "id": "ctr_002",
        "client": "Neural Elite",
        "title": "Подготовка элитного актива",
        "description": "Тренировка высококлассного актива с премиум имплантами для VIP клиента.",
        "requirements": {
          "skills": { "etiquette": 2, "dance": 1 },
          "minRank": "C"
        },
        "reward": 500,
        "deadline": 3,
        "kpi": [
          { "name": "Элегантность", "weight": 0.8, "current": 0, "target": 100 },
          { "name": "Подчинение", "weight": 0.2, "current": 0, "target": 100 }
        ],
        "assignedTalents": [],
        "status": "available",
        "storyScenes": {
          "onAccept": ["client_meeting", "requirements_assessment"],
          "onProgress": ["training_session", "resistance_handling"],
          "onComplete": ["final_demo", "client_satisfaction"],
          "onFail": ["training_failure", "contract_termination"]
        }
      },
      {
        "id": "ctr_003",
        "client": "CyberCorp",
        "title": "Специалист по нейрохакерству",
        "description": "Требуется актив с продвинутыми навыками нейрохакерства для корпоративной безопасности.",
        "requirements": {
          "skills": { "neural_hacking": 4, "data": 3 },
          "minRank": "B"
        },
        "reward": 1200,
        "deadline": 7,
        "kpi": [
          { "name": "Технические навыки", "weight": 0.7, "current": 0, "target": 100 },
          { "name": "Безопасность", "weight": 0.3, "current": 0, "target": 100 }
        ],
        "assignedTalents": [],
        "status": "available",
        "storyScenes": {
          "onAccept": ["tech_assessment", "security_briefing"],
          "onProgress": ["hacking_training", "security_testing"],
          "onComplete": ["final_evaluation", "deployment"],
          "onFail": ["security_breach", "contract_termination"]
        }
      }
    ]
  };
}

// Функция для синхронизации данных
function syncProdData() {
  console.log('🔄 Начинаем синхронизацию данных из prod в dev...');
  
  const prodData = getLocalStorageData();
  
  // Синхронизируем активы
  if (prodData.assets) {
    const assetsPath = path.join(__dirname, '../data/assets.json');
    const currentAssets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    
    // Обновляем активы
    currentAssets.assets = prodData.assets;
    
    // Записываем обратно
    fs.writeFileSync(assetsPath, JSON.stringify(currentAssets, null, 2));
    console.log(`✅ Синхронизировано ${prodData.assets.length} активов в assets.json`);
  }
  
  // Синхронизируем characters-unified.json
  const charactersPath = path.join(__dirname, '../data/characters-unified.json');
  const currentCharacters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
  
  // Обновляем персонажей
  currentCharacters.characters = prodData.assets.map(asset => ({
    ...asset,
    // Добавляем обязательное поле states
    states: {
      mood: asset.condition?.mental_state || 75,
      stress: asset.condition?.stress || 25,
      obedience: asset.attributes?.obedience || 2,
      awareness: asset.attributes?.loyalty || 2,
      devotion: asset.attributes?.loyalty || 2,
      sensuality: 3,
      sensory_overload: 1
    },
    metadata: {
      source: "prod_sync",
      createdAt: asset.history?.created || new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  }));
  
  // Записываем обратно
  fs.writeFileSync(charactersPath, JSON.stringify(currentCharacters, null, 2));
  console.log(`✅ Синхронизировано ${prodData.assets.length} персонажей в characters-unified.json`);
  
  // Синхронизируем контракты
  if (prodData.contracts) {
    const contractsPath = path.join(__dirname, '../data/contracts.json');
    const currentContracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
    
    // Обновляем контракты
    currentContracts.available = prodData.contracts;
    
    // Записываем обратно
    fs.writeFileSync(contractsPath, JSON.stringify(currentContracts, null, 2));
    console.log(`✅ Синхронизировано ${prodData.contracts.length} контрактов в contracts.json`);
  }
  
  console.log('✅ Синхронизация завершена!');
}

// Запускаем синхронизацию
syncProdData();
