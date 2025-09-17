# 📊 План заполнения базы данных CyberJack v2.0

## 🎯 Общая концепция

Документ содержит полный план заполнения базы данных с нуля на основе референсного наратива "Калибратор активов". Система построена вокруг NSFW игры с BDSM элементами, где игрок взаимодействует с активами (персонажами) через систему характеристик, фетишей, анатомических зон и оборудования.

## 🏗️ Архитектура системы

### Основные принципы:
- **100-балльная система характеристик** (0-100)
- **Фетиши как характеристики** с активацией через ИИ и анатомию
- **Сложные формулы** с условиями и модификаторами
- **Оборудование как условие** для специальных поз
- **Непрерывные эффекты** оборудования каждую минуту игрового времени

---

## 📋 1. СИСТЕМА ХАРАКТЕРИСТИК (CharacteristicDefinition)

### 1.1 Базовые характеристики

| ID | Название | Категория | Описание | Min | Max |
|---|---|---|---|---|---|
| `sensitivity` | Чувствительность | physical | Восприимчивость к физическим и эмоциональным воздействиям | 0 | 100 |
| `endurance` | Выносливость | physical | Способность выдерживать физические нагрузки | 0 | 100 |
| `flexibility` | Гибкость | physical | Физическая гибкость и способность принимать различные позы | 0 | 100 |
| `emotional_stability` | Эмоциональная стабильность | psychological | Способность контролировать эмоции | 0 | 100 |
| `adaptability` | Адаптивность | psychological | Способность приспосабливаться к новым условиям | 0 | 100 |
| `intelligence` | Интеллект | psychological | Умственные способности и анализ ситуаций | 0 | 100 |
| `sociability` | Общительность | social | Способность и желание общаться | 0 | 100 |
| `empathy` | Эмпатия | social | Способность понимать эмоции других | 0 | 100 |
| `dominance` | Доминантность | social | Стремление к лидерству и контролю | 0 | 100 |
| `self_esteem` | Самооценка | personality | Восприятие собственной ценности | 0 | 100 |
| `optimism` | Оптимизм | personality | Вера в лучшее будущее | 0 | 100 |
| `curiosity` | Любопытство | personality | Стремление к новым знаниям | 0 | 100 |
| `sexual_experience` | Сексуальная опытность | special | Опыт в интимных отношениях | 0 | 100 |
| `resistance` | Сопротивляемость | special | Способность сопротивляться принуждению | 0 | 100 |
| `dependence` | Зависимость | special | Склонность к эмоциональным зависимостям | 0 | 100 |

### 1.2 Общие фетиши (как характеристики)

| ID | Название | Категория | Описание | Min | Max |
|---|---|---|---|---|---|
| `innocence` | Невинность | fetish | Склонность к невинному поведению | 0 | 100 |
| `submission` | Подчинение | fetish | Желание подчиняться | 0 | 100 |
| `domination` | Доминирование | fetish | Стремление к контролю | 0 | 100 |
| `masochism` | Мазохизм | fetish | Получение удовольствия от боли | 0 | 100 |
| `sadism` | Садизм | fetish | Получение удовольствия от причинения боли | 0 | 100 |
| `humiliation` | Унижение | fetish | Удовольствие от унижения | 0 | 100 |
| `exhibitionism` | Эксгибиционизм | fetish | Удовольствие от обнажения | 0 | 100 |
| `voyeurism` | Вуайеризм | fetish | Удовольствие от наблюдения | 0 | 100 |

### 1.3 Анатомические фетиши

| ID | Название | Категория | Описание | Min | Max |
|---|---|---|---|---|---|
| `foot_fetish` | Фут-фетиш | anatomy_fetish | Фетиш на ступни и ноги | 0 | 100 |
| `anal_fetish` | Анал-фетиш | anatomy_fetish | Фетиш на анальную область | 0 | 100 |
| `breast_fetish` | Брест-фетиш | anatomy_fetish | Фетиш на грудь и соски | 0 | 100 |
| `hand_fetish` | Хенд-фетиш | anatomy_fetish | Фетиш на руки и ладони | 0 | 100 |
| `neck_fetish` | Нек-фетиш | anatomy_fetish | Фетиш на шею и горло | 0 | 100 |

---

## 🎭 2. СИСТЕМА АНАТОМИИ (AnatomyDefinition)

### 2.1 Основные зоны

| ID | Название | Категория | Описание |
|---|---|---|---|
| `chest` | Грудь | main | Основная область груди |
| `stomach` | Живот | main | Область живота |
| `back` | Спина | main | Область спины |
| `legs` | Ноги | main | Область ног |
| `arms` | Руки | main | Область рук |

### 2.2 Интимные зоны

| ID | Название | Категория | Описание |
|---|---|---|---|
| `vagina` | Вагина | intimate | Вагинальная область |
| `anus` | Анус | intimate | Анальная область |
| `clitoris` | Клитор | intimate | Клиторальная область |
| `nipples` | Соски | intimate | Область сосков |

### 2.3 Специальные зоны

| ID | Название | Категория | Описание |
|---|---|---|---|
| `neck` | Шея | special | Область шеи |
| `ears` | Уши | special | Область ушей |
| `feet` | Ступни | special | Область ступней |
| `palms` | Ладони | special | Область ладоней |

---

## 🎪 3. СИСТЕМА ПОЗ (PoseDefinition)

### 3.1 Базовые позы

| ID | Название | Категория | Описание | Требования |
|---|---|---|---|---|
| `standing` | Стоя | basic | Стандартная поза стоя | Нет |
| `sitting` | Сидя | basic | Поза сидя | Нет |
| `lying` | Лежа | basic | Поза лежа | Нет |
| `kneeling` | На коленях | basic | Поза на коленях | Нет |

### 3.2 Специальные позы (требуют оборудование)

| ID | Название | Категория | Описание | Требования |
|---|---|---|---|---|
| `in_capsule` | В капсуле | special | Поза в гидро-санайзере | Гидро-Санайзер |
| `bound_for_punishment` | Связанная для наказания | special | Поза для плети-метронома | Плеть-Метроном |
| `under_observation` | Под наблюдением | special | Поза под нейронным ревербератором | Нейронный ревербератор |

### 3.3 Эффекты поз

```json
{
  "in_capsule": {
    "effects": {
      "sensitivity": "+0.5 per minute",
      "description": "Повышает чувствительность всего тела"
    }
  },
  "bound_for_punishment": {
    "effects": {
      "pain": "+2 per minute",
      "fear": "+pain * 0.3",
      "description": "Накопление боли и страха"
    }
  },
  "under_observation": {
    "effects": {
      "all_effects": "*1.5",
      "analytics": "+1 per minute",
      "description": "Усиление всех эффектов + аналитика"
    }
  }
}
```

---

## ⚡ 4. СИСТЕМА ДЕЙСТВИЙ (Action)

### 4.1 Категория: Ласка

| ID | Название | Категория | Интенсивность | Стоимость | Описание |
|---|---|---|---|---|---|
| `gentle_stroke` | Поглаживание | ласка | 30 | 5 | Нежное прикосновение рукой |
| `kiss` | Поцелуй | ласка | 25 | 3 | Мягкое воздействие губами |
| `massage` | Массаж | ласка | 40 | 8 | Ритмичные движения для расслабления |

### 4.2 Категория: Пытка

| ID | Название | Категория | Интенсивность | Стоимость | Описание |
|---|---|---|---|---|---|
| `strike` | Удар | пытка | 60 | 10 | Резкое физическое воздействие |
| `pinch` | Щипок | пытка | 45 | 6 | Сжатие кожи пальцами |
| `bite` | Укус | пытка | 55 | 8 | Воздействие зубами |

### 4.3 Категория: Стимуляция

| ID | Название | Категория | Интенсивность | Стоимость | Описание |
|---|---|---|---|---|---|
| `brush` | Щётка | стимуляция | 50 | 7 | Воздействие щетиной |
| `vibrator` | Вибратор | стимуляция | 70 | 12 | Вибрационное воздействие |
| `electric_shock` | Электрошок | стимуляция | 80 | 15 | Электрическое воздействие |

### 4.4 Формулы эффектов действий

```javascript
// Базовая формула эффекта
function calculateActionEffect(action, character, user, zone, equipment) {
  let baseEffect = action.baseEffect || 10
  let intensity = action.intensity || 50

  // Базовые модификаторы
  let sensitivity = character.characteristics.чувствительность || 50
  let userModifier = user.modifiers.general || 1.0
  let equipmentModifier = equipment ? equipment.modifier : 1.0

  // Расчет базового эффекта
  let effect = baseEffect * (intensity / 100) * (sensitivity / 100) * userModifier * equipmentModifier

  // Модификаторы по категории действия
  if (action.category === 'ласка') {
    let невинность = character.characteristics.невинность || 0
    effect *= (1 + невинность / 200)
  }

  if (action.category === 'пытка') {
    let мазохизм = character.characteristics.мазохизм || 0
    effect *= (1 + мазохизм / 200)
  }

  if (action.category === 'стимуляция') {
    let зависимость = character.characteristics.зависимость || 0
    effect *= (1 + зависимость / 300)
  }

  // Анатомические фетиши
  if (zone && zone.anatomy) {
    let anatomyFetish = 0

    switch (zone.anatomy.category) {
      case 'ноги':
      case 'ступни':
        anatomyFetish = character.characteristics['фут-фетиш'] || 0
        break
      case 'анус':
        anatomyFetish = character.characteristics['анал-фетиш'] || 0
        break
      case 'грудь':
      case 'соски':
        anatomyFetish = character.characteristics['брест-фетиш'] || 0
        break
      case 'руки':
      case 'ладони':
        anatomyFetish = character.characteristics['хенд-фетиш'] || 0
        break
      case 'шея':
      case 'горло':
        anatomyFetish = character.characteristics['нек-фетиш'] || 0
        break
    }

    effect *= (1 + anatomyFetish / 150)
  }

  // Модификатор зоны
  if (zone && zone.sensitivity) {
    effect *= (zone.sensitivity / 100)
  }

  return Math.round(effect * 100) / 100
}
```

---

## 👥 5. ПЕРСОНАЖИ-АКТИВЫ (Character)

### 5.1 Анечка - Доверчивый подросток

```json
{
  "id": "anetchka",
  "name": "Анечка",
  "description": "Доверчивый подросток 17 лет с невинным характером",
  "age": 17,
  "avatar": "/images/characters/anetchka.jpg",
  "isActive": true,
  "characteristics": {
    "sensitivity": 80,
    "endurance": 40,
    "flexibility": 60,
    "emotional_stability": 50,
    "adaptability": 70,
    "intelligence": 60,
    "sociability": 80,
    "empathy": 85,
    "dominance": 20,
    "self_esteem": 60,
    "optimism": 75,
    "curiosity": 70,
    "sexual_experience": 10,
    "resistance": 30,
    "dependence": 60
  },
  "fetishes": {
    "innocence": 90,
    "submission": 70,
    "domination": 10,
    "masochism": 30,
    "sadism": 5,
    "humiliation": 40,
    "exhibitionism": 20,
    "voyeurism": 15
  },
  "anatomy_fetishes": {
    "foot_fetish": 20,
    "anal_fetish": 10,
    "breast_fetish": 30,
    "hand_fetish": 15,
    "neck_fetish": 25
  },
  "anatomy": {
    "chest": { "hasPart": true, "sensitivity": 70 },
    "stomach": { "hasPart": true, "sensitivity": 60 },
    "back": { "hasPart": true, "sensitivity": 50 },
    "legs": { "hasPart": true, "sensitivity": 65 },
    "arms": { "hasPart": true, "sensitivity": 55 },
    "vagina": { "hasPart": true, "sensitivity": 80 },
    "anus": { "hasPart": true, "sensitivity": 70 },
    "clitoris": { "hasPart": true, "sensitivity": 85 },
    "nipples": { "hasPart": true, "sensitivity": 75 },
    "neck": { "hasPart": true, "sensitivity": 65 },
    "ears": { "hasPart": true, "sensitivity": 60 },
    "feet": { "hasPart": true, "sensitivity": 55 },
    "palms": { "hasPart": true, "sensitivity": 50 }
  }
}
```

### 5.2 Кай - Женственный художник

```json
{
  "id": "kai",
  "name": "Кай",
  "description": "Женственный художник 22 лет, покорный и напуганный",
  "age": 22,
  "avatar": "/images/characters/kai.jpg",
  "isActive": true,
  "characteristics": {
    "sensitivity": 85,
    "endurance": 50,
    "flexibility": 75,
    "emotional_stability": 40,
    "adaptability": 60,
    "intelligence": 70,
    "sociability": 60,
    "empathy": 80,
    "dominance": 20,
    "self_esteem": 45,
    "optimism": 50,
    "curiosity": 80,
    "sexual_experience": 30,
    "resistance": 35,
    "dependence": 70
  },
  "fetishes": {
    "innocence": 40,
    "submission": 80,
    "domination": 15,
    "masochism": 60,
    "sadism": 10,
    "humiliation": 60,
    "exhibitionism": 40,
    "voyeurism": 30
  },
  "anatomy_fetishes": {
    "foot_fetish": 40,
    "anal_fetish": 60,
    "breast_fetish": 50,
    "hand_fetish": 35,
    "neck_fetish": 45
  },
  "anatomy": {
    "chest": { "hasPart": true, "sensitivity": 80 },
    "stomach": { "hasPart": true, "sensitivity": 70 },
    "back": { "hasPart": true, "sensitivity": 60 },
    "legs": { "hasPart": true, "sensitivity": 75 },
    "arms": { "hasPart": true, "sensitivity": 65 },
    "vagina": { "hasPart": true, "sensitivity": 90 },
    "anus": { "hasPart": true, "sensitivity": 85 },
    "clitoris": { "hasPart": true, "sensitivity": 95 },
    "nipples": { "hasPart": true, "sensitivity": 85 },
    "neck": { "hasPart": true, "sensitivity": 75 },
    "ears": { "hasPart": true, "sensitivity": 70 },
    "feet": { "hasPart": true, "sensitivity": 65 },
    "palms": { "hasPart": true, "sensitivity": 60 }
  }
}
```

### 5.3 Линь Сюэжань - Исследовательница

```json
{
  "id": "lin_xuejian",
  "name": "Линь Сюэжань",
  "description": "Исследовательница 28 лет, добровольно ставшая активом для изучения",
  "age": 28,
  "avatar": "/images/characters/lin_xuejian.jpg",
  "isActive": true,
  "characteristics": {
    "sensitivity": 60,
    "endurance": 70,
    "flexibility": 50,
    "emotional_stability": 80,
    "adaptability": 85,
    "intelligence": 90,
    "sociability": 70,
    "empathy": 60,
    "dominance": 80,
    "self_esteem": 85,
    "optimism": 70,
    "curiosity": 95,
    "sexual_experience": 60,
    "resistance": 70,
    "dependence": 40
  },
  "fetishes": {
    "innocence": 20,
    "submission": 30,
    "domination": 70,
    "masochism": 25,
    "sadism": 40,
    "humiliation": 35,
    "exhibitionism": 30,
    "voyeurism": 50
  },
  "anatomy_fetishes": {
    "foot_fetish": 30,
    "anal_fetish": 20,
    "breast_fetish": 25,
    "hand_fetish": 40,
    "neck_fetish": 35
  },
  "anatomy": {
    "chest": { "hasPart": true, "sensitivity": 50 },
    "stomach": { "hasPart": true, "sensitivity": 45 },
    "back": { "hasPart": true, "sensitivity": 40 },
    "legs": { "hasPart": true, "sensitivity": 55 },
    "arms": { "hasPart": true, "sensitivity": 50 },
    "vagina": { "hasPart": true, "sensitivity": 60 },
    "anus": { "hasPart": true, "sensitivity": 55 },
    "clitoris": { "hasPart": true, "sensitivity": 65 },
    "nipples": { "hasPart": true, "sensitivity": 55 },
    "neck": { "hasPart": true, "sensitivity": 50 },
    "ears": { "hasPart": true, "sensitivity": 45 },
    "feet": { "hasPart": true, "sensitivity": 40 },
    "palms": { "hasPart": true, "sensitivity": 45 }
  }
}
```

---

## 🔧 6. ОБОРУДОВАНИЕ (Equipment)

### 6.1 Гидро-Санайзер

```json
{
  "id": "hydro_sanitizer",
  "name": "Гидро-Санайзер",
  "category": "enhancement",
  "description": "Капсула для повышения чувствительности всего тела",
  "rarity": "RARE",
  "cost": 1000,
  "requirements": {},
  "effects": {
    "continuous": {
      "sensitivity": "+0.5 per minute",
      "max_effect": 20,
      "max_time": 40
    },
    "pose_requirement": "in_capsule"
  },
  "formula": "sensitivity += 0.5 * (time_in_capsule / 60)"
}
```

### 6.2 Плеть-Метроном

```json
{
  "id": "whip_metronome",
  "name": "Плеть-Метроном",
  "category": "punishment",
  "description": "Система наказания с ритмичными ударами",
  "rarity": "UNCOMMON",
  "cost": 800,
  "requirements": {},
  "effects": {
    "continuous": {
      "pain": "+2 per minute",
      "fear": "+pain * 0.3",
      "submission": "+0.3 per minute"
    },
    "pose_requirement": "bound_for_punishment"
  },
  "formula": "pain += 2 * metronome_rhythm, fear += pain * 0.3"
}
```

### 6.3 Нейронный ревербератор

```json
{
  "id": "neural_reverberator",
  "name": "Нейронный ревербератор",
  "category": "analysis",
  "description": "Система разгона ощущений для анализа",
  "rarity": "EPIC",
  "cost": 1200,
  "requirements": {},
  "effects": {
    "continuous": {
      "all_effects": "*1.5",
      "analytics": "+1 per minute",
      "intelligence": "+0.2 per minute"
    },
    "pose_requirement": "under_observation"
  },
  "formula": "all_effects *= 1.5, analytics += 1"
}
```

---

## 🏢 7. СЮЖЕТНЫЕ ЭЛЕМЕНТЫ

### 7.1 Отдел снабжения (StationEntity)

```json
{
  "id": "supply_department",
  "name": "Отдел снабжения",
  "type": "shop",
  "description": "Место покупки и продажи активов и оборудования",
  "isActive": true,
  "metadata": {
    "shop_type": "assets_and_equipment",
    "currency": "credits"
  }
}
```

### 7.2 Сцена покупки активов (Scene)

```json
{
  "id": "buy_assets_scene",
  "name": "Покупка активов",
  "description": "Сцена выбора и покупки активов",
  "stationId": "supply_department",
  "triggerConditions": {},
  "probability": 100,
  "screens": [
    {
      "id": "assets_list_screen",
      "name": "Список доступных активов",
      "description": "Выбор актива для покупки",
      "content": {
        "title": "Доступные активы",
        "assets": [
          {
            "id": "anetchka",
            "name": "Анечка",
            "price": 500,
            "description": "Доверчивый подросток 17 лет"
          },
          {
            "id": "kai",
            "name": "Кай",
            "price": 600,
            "description": "Женственный художник 22 лет"
          },
          {
            "id": "lin_xuejian",
            "name": "Линь Сюэжань",
            "price": 800,
            "description": "Исследовательница 28 лет"
          }
        ]
      },
      "choices": [
        {
          "id": "buy_anetchka",
          "text": "Купить Анечку (500 кредитов)",
          "consequences": {
            "credits": -500,
            "add_character": "anetchka"
          }
        },
        {
          "id": "buy_kai",
          "text": "Купить Кая (600 кредитов)",
          "consequences": {
            "credits": -600,
            "add_character": "kai"
          }
        },
        {
          "id": "buy_lin_xuejian",
          "text": "Купить Линь Сюэжань (800 кредитов)",
          "consequences": {
            "credits": -800,
            "add_character": "lin_xuejian"
          }
        }
      ]
    }
  ]
}
```

### 7.3 Сцена покупки оборудования (Scene)

```json
{
  "id": "buy_equipment_scene",
  "name": "Покупка оборудования",
  "description": "Сцена выбора и покупки оборудования",
  "stationId": "supply_department",
  "triggerConditions": {},
  "probability": 100,
  "screens": [
    {
      "id": "equipment_list_screen",
      "name": "Список доступного оборудования",
      "description": "Выбор оборудования для покупки",
      "content": {
        "title": "Доступное оборудование",
        "equipment": [
          {
            "id": "hydro_sanitizer",
            "name": "Гидро-Санайзер",
            "price": 1000,
            "description": "Капсула для повышения чувствительности"
          },
          {
            "id": "whip_metronome",
            "name": "Плеть-Метроном",
            "price": 800,
            "description": "Система наказания с ритмичными ударами"
          },
          {
            "id": "neural_reverberator",
            "name": "Нейронный ревербератор",
            "price": 1200,
            "description": "Система разгона ощущений для анализа"
          }
        ]
      },
      "choices": [
        {
          "id": "buy_hydro_sanitizer",
          "text": "Купить Гидро-Санайзер (1000 кредитов)",
          "consequences": {
            "credits": -1000,
            "add_equipment": "hydro_sanitizer"
          }
        },
        {
          "id": "buy_whip_metronome",
          "text": "Купить Плеть-Метроном (800 кредитов)",
          "consequences": {
            "credits": -800,
            "add_equipment": "whip_metronome"
          }
        },
        {
          "id": "buy_neural_reverberator",
          "text": "Купить Нейронный ревербератор (1200 кредитов)",
          "consequences": {
            "credits": -1200,
            "add_equipment": "neural_reverberator"
          }
        }
      ]
    }
  ]
}
```

---

## 🤖 8. ИИ-СИСТЕМА И ФЕТИШИ

### 8.1 Активация фетишей через анализ сообщений

```javascript
// Обработка фетиш-элементов в MessageAnalysis
function processFetishElements(analysis, character) {
  const fetishChanges = []

  for (const fetish of analysis.fetishElements) {
    if (fetish.confidence > 0.4) {
      const fetishType = mapFetishType(fetish.type)
      if (fetishType && character.characteristics[fetishType] !== undefined) {
        const change = fetish.intensity * 0.1
        const newValue = Math.min(100, character.characteristics[fetishType] + change)

        fetishChanges.push({
          fetishType,
          oldValue: character.characteristics[fetishType],
          newValue,
          change
        })
      }
    }
  }

  return fetishChanges
}

// Маппинг типов фетишей
function mapFetishType(fetishType) {
  const mapping = {
    'innocence': 'innocence',
    'submission': 'submission',
    'domination': 'domination',
    'masochism': 'masochism',
    'sadism': 'sadism',
    'humiliation': 'humiliation',
    'exhibitionism': 'exhibitionism',
    'voyeurism': 'voyeurism',
    'foot_fetish': 'foot_fetish',
    'anal_fetish': 'anal_fetish',
    'breast_fetish': 'breast_fetish',
    'hand_fetish': 'hand_fetish',
    'neck_fetish': 'neck_fetish'
  }

  return mapping[fetishType] || null
}
```

### 8.2 Активация анатомических фетишей через воздействие

```javascript
// Активация анатомических фетишей при воздействии на зоны
function activateAnatomyFetish(character, zone, action) {
  let fetishType = null
  let activationStrength = 0

  // Определяем тип фетиша по зоне
  switch (zone.anatomy.category) {
    case 'ноги':
    case 'ступни':
      fetishType = 'foot_fetish'
      break
    case 'анус':
      fetishType = 'anal_fetish'
      break
    case 'грудь':
    case 'соски':
      fetishType = 'breast_fetish'
      break
    case 'руки':
    case 'ладони':
      fetishType = 'hand_fetish'
      break
    case 'шея':
    case 'горло':
      fetishType = 'neck_fetish'
      break
  }

  if (fetishType) {
    // Сила активации зависит от интенсивности действия
    activationStrength = (action.intensity / 100) * 0.5

    // Увеличиваем фетиш
    const currentFetish = character.characteristics[fetishType] || 0
    const newFetish = Math.min(100, currentFetish + activationStrength)

    return {
      fetishType,
      oldValue: currentFetish,
      newValue: newFetish,
      change: activationStrength
    }
  }

  return null
}
```

### 8.3 ИИ-модификаторы с учетом фетишей

```javascript
// Расчет модификаторов для ИИ-ответов
function calculateAIModifier(character, messageAnalysis, currentZone) {
  let baseModifier = 1.0

  // Модификаторы общих фетишей
  const доминирование = character.characteristics.domination || 0
  const подчинение = character.characteristics.submission || 0
  baseModifier += (доминирование - подчинение) / 200

  // Модификаторы анатомических фетишей (если есть активная зона)
  if (currentZone && currentZone.anatomy) {
    let anatomyFetish = 0

    switch (currentZone.anatomy.category) {
      case 'ноги':
      case 'ступни':
        anatomyFetish = character.characteristics.foot_fetish || 0
        break
      case 'анус':
        anatomyFetish = character.characteristics.anal_fetish || 0
        break
      case 'грудь':
      case 'соски':
        anatomyFetish = character.characteristics.breast_fetish || 0
        break
      case 'руки':
      case 'ладони':
        anatomyFetish = character.characteristics.hand_fetish || 0
        break
      case 'шея':
      case 'горло':
        anatomyFetish = character.characteristics.neck_fetish || 0
        break
    }

    // Анатомический фетиш влияет на ИИ-ответы
    baseModifier += anatomyFetish / 300
  }

  // Модификаторы от анализа сообщения
  if (messageAnalysis.fetishElements.length > 0) {
    for (const fetish of messageAnalysis.fetishElements) {
      if (fetish.confidence > 0.4) {
        baseModifier += fetish.intensity * 0.1
      }
    }
  }

  // Модификатор позы
  if (character.currentPose === 'bound_for_punishment') {
    baseModifier *= 1.2
  }

  return Math.max(0.1, Math.min(3.0, baseModifier))
}
```

---

## 📊 9. СТАТИСТИКА И ОБЪЕМ ДАННЫХ

### 9.1 Общий объем данных

| Категория | Количество элементов |
|---|---|
| **Характеристики** | 23 (15 базовых + 8 фетишей) |
| **Анатомические зоны** | 13 |
| **Позы** | 7 (4 базовые + 3 специальные) |
| **Действия** | 9 (3 категории по 3 действия) |
| **Персонажи** | 3 |
| **Оборудование** | 3 |
| **Станции** | 1 |
| **Сцены** | 2 |
| **Экраны** | 2 |
| **Выборы** | 6 |

### 9.2 Сложность формул

- **Базовые формулы**: 3 (ласка, пытка, стимуляция)
- **Модификаторы фетишей**: 8 общих + 5 анатомических
- **Модификаторы зон**: 13 анатомических зон
- **Модификаторы поз**: 3 специальные позы
- **ИИ-модификаторы**: Комплексная система с учетом всех факторов

---

## 🚀 10. ПЛАН РЕАЛИЗАЦИИ

### Этап 1: Базовая структура (1-2 дня)
1. Создать определения характеристик
2. Создать определения анатомии
3. Создать базовые позы

### Этап 2: Действия и формулы (2-3 дня)
1. Создать действия с формулами
2. Реализовать систему модификаторов
3. Протестировать формулы эффектов

### Этап 3: Персонажи (1-2 дня)
1. Создать персонажей с характеристиками
2. Настроить анатомию для каждого персонажа
3. Протестировать взаимодействие

### Этап 4: Оборудование и позы (1-2 дня)
1. Создать оборудование
2. Создать специальные позы
3. Реализовать непрерывные эффекты

### Этап 5: Сюжетные элементы (1 день)
1. Создать отдел снабжения
2. Создать сцены покупки
3. Протестировать сюжетный поток

### Этап 6: ИИ-интеграция (2-3 дня)
1. Интегрировать фетиши с ИИ-анализом
2. Реализовать анатомические модификаторы
3. Протестировать ИИ-ответы

---

## ✅ 11. КРИТЕРИИ ГОТОВНОСТИ

### Функциональные требования:
- [ ] Все характеристики созданы и работают
- [ ] Все действия применяют правильные формулы
- [ ] Фетиши активируются через ИИ и анатомию
- [ ] Оборудование работает как условие для поз
- [ ] Непрерывные эффекты применяются каждую минуту
- [ ] Сюжетные элементы функционируют
- [ ] ИИ-система учитывает все модификаторы

### Технические требования:
- [ ] Все данные загружаются в БД
- [ ] Формулы выполняются без ошибок
- [ ] Система масштабируется
- [ ] Производительность приемлема
- [ ] Логирование работает корректно

---

**Документ готов к реализации! Все системы спроектированы с учетом архитектуры CyberJack v2.0 и готовы к заполнению базы данных.**
