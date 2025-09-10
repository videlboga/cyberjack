# 🗄️ Маппинг полей базы данных CyberJack

## 📋 Обзор

Этот документ содержит детальный маппинг каждого поля базы данных с указанием:
- В каких конфигах встречается функционально
- В каких функциях используется
- Связи между таблицами

---

## 🧑‍💼 ТАБЛИЦА: characters

### Основные поля

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `characters-unified.json` | `findById()`, `update()`, `delete()` | Уникальный идентификатор персонажа |
| `name` | `characters-unified.json` | `findAll()`, `search()`, `create()` | Имя персонажа |
| `rank` | `characters-unified.json` | `search()`, `CharacterAnalysisPanel` | Ранг персонажа (F-, F, F+, D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+, S-, S, S+) |
| `status` | `characters-unified.json` | `search()`, `CharacterEditor` | Статус персонажа (available, owned, training, assigned, inactive, deleted) |
| `location` | `characters-unified.json` | `search()`, `CharacterEditor` | Локация персонажа (talent_exchange, void_border, corporate_lab, neural_forge, player_base) |
| `source` | `characters-unified.json` | `CharacterEditor` | Источник персонажа (market, void, corporate, custom) |
| `archetype` | `characters-unified.json` | `CharacterAnalysisPanel` | Архетип персонажа |
| `description` | `characters-unified.json` | `CharacterEditor`, `CharacterAnalysisPanel` | Описание персонажа |
| `avatar` | `characters-unified.json` | `CharacterEditor`, UI компоненты | Аватар персонажа (эмодзи) |
| `price` | `characters-unified.json` | `CharacterEditor`, экономические расчеты | Цена персонажа |
| `specialization` | `characters-unified.json` | `CharacterEditor` | Специализация персонажа |
| `emotional_state` | `characters-unified.json` | `CharacterAI`, `CharacterAnalysisPanel` | Эмоциональное состояние (neutral, happy, sad, angry, etc.) |
| `communication_style` | `characters-unified.json` | `CharacterAI`, `CharacterAnalysisPanel` | Стиль общения (neutral, formal, casual, etc.) |
| `created_at` | `characters-unified.json` | `findAll()`, `search()` | Дата создания |
| `last_interaction` | `characters-unified.json` | `CharacterAI`, `CharacterAnalysisPanel` | Последнее взаимодействие |
| `total_interactions` | `characters-unified.json` | `CharacterAI`, статистика | Общее количество взаимодействий |
| `metadata` | `characters-unified.json` | `CharacterEditor`, `CharacterAnalysisPanel` | Дополнительные метаданные (JSON) |

---

## 🎯 ТАБЛИЦА: character_attributes

### Поля атрибутов

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `character_id` | `characters-unified.json` | `getAttributes()`, `saveAttributes()` | Связь с персонажем |
| `category` | `characters-unified.json` | `getAttributes()`, `CharacterAnalysisPanel` | Категория атрибута (physical, psychological, social, personality, special) |
| `attribute_name` | `characters-unified.json` | `getAttributes()`, `CharacterAnalysisPanel` | Название атрибута |
| `value` | `characters-unified.json` | `getAttributes()`, `CharacterAnalysisPanel`, `CharacterAI` | Значение атрибута (0-10) |

### Детальный маппинг атрибутов:

#### Physical (Физические)
| Атрибут | Конфиг | Функции | Описание |
|---------|--------|---------|----------|
| `Выносливость` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность выдерживать физические нагрузки |
| `Чувствительность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Восприимчивость к физическим воздействиям |
| `Гибкость` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Физическая гибкость и способность принимать позы |

#### Psychological (Психологические)
| Атрибут | Конфиг | Функции | Описание |
|---------|--------|---------|----------|
| `Эмоциональная стабильность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность контролировать эмоции |
| `Адаптивность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность приспосабливаться к изменениям |
| `Интеллект` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Умственные способности и анализ ситуации |

#### Social (Социальные)
| Атрибут | Конфиг | Функции | Описание |
|---------|--------|---------|----------|
| `Общительность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность и желание общаться |
| `Эмпатия` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность понимать эмоции других |
| `Доминантность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Стремление к лидерству и контролю |

#### Personality (Личностные)
| Атрибут | Конфиг | Функции | Описание |
|---------|--------|---------|----------|
| `Самооценка` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Восприятие собственной ценности |
| `Оптимизм` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Вера в лучшее будущее |
| `Любопытство` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Стремление к новым знаниям и опыту |

#### Special (Специальные)
| Атрибут | Конфиг | Функции | Описание |
|---------|--------|---------|----------|
| `Сексуальная опытность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Опыт в интимных отношениях |
| `Сопротивляемость` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность сопротивляться принуждению |
| `Зависимость` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Склонность к формированию зависимостей |

---

## 🎭 ТАБЛИЦА: character_states

### Поля состояний

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `character_id` | `characters-unified.json` | `getStates()`, `saveStates()` | Связь с персонажем |
| `state_name` | `characters-unified.json` | `getStates()`, `CharacterAnalysisPanel` | Название состояния |
| `value` | `characters-unified.json` | `getStates()`, `CharacterAnalysisPanel`, `CharacterAI` | Значение состояния (0-100) |

### Детальный маппинг состояний:

| Состояние | Конфиг | Функции | Описание |
|-----------|--------|---------|----------|
| `Настроение` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Общее эмоциональное состояние |
| `Тревожность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Уровень тревоги и беспокойства |
| `Выгорание` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Эмоциональное истощение |
| `Вовлеченность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Степень вовлеченности в деятельность |
| `Чувство права` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Уверенность в собственной правоте |
| `Проницательность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность понимать скрытые мотивы |
| `Рутина` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Привычка к повторяющимся действиям |
| `Послушание` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Готовность выполнять приказы |
| `Нейропластичность` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Способность мозга адаптироваться |
| `Когнитивная нагрузка` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Уровень умственной нагрузки |

---

## 🎯 ТАБЛИЦА: character_skills

### Поля навыков

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `character_id` | `characters-unified.json` | `getSkills()`, `saveSkills()` | Связь с персонажем |
| `skill_name` | `characters-unified.json` | `getSkills()`, `CharacterAnalysisPanel` | Название навыка |
| `level` | `characters-unified.json` | `getSkills()`, `CharacterAnalysisPanel`, `CharacterAI` | Уровень навыка (0-10) |

### Детальный маппинг навыков:

| Навык | Конфиг | Функции | Описание |
|-------|--------|---------|----------|
| `maid` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Навыки горничной |
| `cooking` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Кулинарные навыки |
| `neural_hacking` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Нейрохакинг |
| `orgasm_control` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Контроль оргазмов |
| `field` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Полевые навыки |
| `etiquette` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Этикет |
| `logistics` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Логистика |
| `medical` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Медицинские навыки |
| `maintenance` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Техническое обслуживание |
| `data` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Работа с данными |
| `dance` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Танцы |
| `seduction` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Соблазнение |
| `interrogation` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Допрос |
| `surveillance` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Наблюдение |

---

## 🔥 ТАБЛИЦА: character_fetishes

### Поля фетишей

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `character_id` | `characters-unified.json` | `getFetishes()`, `saveFetishes()` | Связь с персонажем |
| `fetish_name` | `characters-unified.json` | `getFetishes()`, `CharacterAnalysisPanel` | Название фетиша |
| `category` | `characters-unified.json` | `getFetishes()`, `CharacterAnalysisPanel` | Категория фетиша (primary, secondary, discovered, hidden) |
| `intensity` | `characters-unified.json` | `getFetishes()`, `CharacterAnalysisPanel`, `CharacterAI` | Интенсивность фетиша (0-10) |

### Детальный маппинг фетишей:

| Фетиш | Конфиг | Функции | Описание |
|-------|--------|---------|----------|
| `sensory_overload` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Сенсорная перегрузка |
| `power_exchange` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Обмен властью |
| `bondage` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Бондаж |
| `humiliation` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Унижение |
| `praise` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Похвала |
| `control` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Контроль |
| `submission` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Подчинение |
| `dominance` | `characters-unified.json` | `CharacterAnalysisPanel`, `CharacterAI` | Доминирование |

---

## ⚡ ТАБЛИЦА: actions

### Поля действий

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Уникальный идентификатор действия |
| `name` | `actions-unified.json` | `loadActions()`, `ActionPanel`, `CharacterAI` | Название действия |
| `description` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Описание действия |
| `category` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Категория действия (training, coaching, therapy, punishment, reward, medical, neural) |
| `type` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Тип действия |
| `cost` | `actions-unified.json` | `loadActions()`, экономические расчеты | Стоимость действия |
| `duration` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Длительность действия (минуты) |
| `risk_level` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Уровень риска (low, medium, high) |
| `effects` | `actions-unified.json` | `loadActions()`, `ActionPanel`, `CharacterAI` | Эффекты действия (JSON) |
| `requirements` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Требования для выполнения (JSON) |
| `enabled` | `actions-unified.json` | `loadActions()`, `ActionPanel` | Включено ли действие |
| `created_at` | `actions-unified.json` | `loadActions()` | Дата создания |
| `updated_at` | `actions-unified.json` | `loadActions()` | Дата обновления |

---

## 📋 ТАБЛИЦА: contracts

### Поля контрактов

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Уникальный идентификатор контракта |
| `client` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Клиент контракта |
| `title` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Название контракта |
| `description` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Описание контракта |
| `requirements` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Требования контракта (JSON) |
| `reward` | `contracts-unified.json` | `loadContracts()`, экономические расчеты | Награда за выполнение |
| `deadline` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Срок выполнения (дни) |
| `kpi` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | KPI контракта (JSON) |
| `assigned_talents` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Назначенные таланты (JSON) |
| `status` | `contracts-unified.json` | `loadContracts()`, `ContractPanel` | Статус контракта (available, in_progress, completed, failed) |
| `story_scenes` | `contracts-unified.json` | `loadContracts()`, `StoryEditor` | Сюжетные сцены контракта (JSON) |
| `created_at` | `contracts-unified.json` | `loadContracts()` | Дата создания |
| `updated_at` | `contracts-unified.json` | `loadContracts()` | Дата обновления |

---

## 🎲 ТАБЛИЦА: events

### Поля событий

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `events-unified.json` | `loadEvents()`, `EventPanel` | Уникальный идентификатор события |
| `title` | `events-unified.json` | `loadEvents()`, `EventPanel` | Название события |
| `description` | `events-unified.json` | `loadEvents()`, `EventPanel` | Описание события |
| `type` | `events-unified.json` | `loadEvents()`, `EventPanel` | Тип события (anomaly, crisis, opportunity, story, random) |
| `probability` | `events-unified.json` | `loadEvents()`, `EventPanel` | Вероятность события (0-1) |
| `effects` | `events-unified.json` | `loadEvents()`, `EventPanel` | Эффекты события (JSON) |
| `trigger_type` | `events-unified.json` | `loadEvents()`, `EventPanel` | Тип триггера (daily, weekly, monthly, conditional, random) |
| `conditions` | `events-unified.json` | `loadEvents()`, `EventPanel` | Условия события (JSON) |
| `created_at` | `events-unified.json` | `loadEvents()` | Дата создания |

---

## 🛠️ ТАБЛИЦА: equipment

### Поля оборудования

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Уникальный идентификатор оборудования |
| `name` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Название оборудования |
| `description` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Описание оборудования |
| `type` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Тип оборудования |
| `category` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Категория оборудования |
| `stats` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Статистики оборудования (JSON) |
| `enabled` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Включено ли оборудование |
| `target_talents` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Целевые таланты (JSON) |
| `power_level` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Уровень мощности |
| `max_power_level` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Максимальный уровень мощности |
| `energy_consumption` | `equipment-unified.json` | `loadEquipment()`, `EquipmentPanel` | Потребление энергии |
| `created_at` | `equipment-unified.json` | `loadEquipment()` | Дата создания |
| `updated_at` | `equipment-unified.json` | `loadEquipment()` | Дата обновления |

---

## 👥 ТАБЛИЦА: users

### Поля пользователей

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `users-unified.json` | `loadUsers()`, `UserPanel` | Уникальный идентификатор пользователя |
| `username` | `users-unified.json` | `loadUsers()`, `UserPanel`, аутентификация | Имя пользователя |
| `password_hash` | `users-unified.json` | аутентификация | Хеш пароля |
| `email` | `users-unified.json` | `loadUsers()`, `UserPanel` | Email пользователя |
| `role` | `users-unified.json` | `loadUsers()`, `UserPanel`, авторизация | Роль пользователя (player, admin, moderator) |
| `credits` | `users-unified.json` | `loadUsers()`, экономические расчеты | Кредиты пользователя |
| `experience` | `users-unified.json` | `loadUsers()`, `UserPanel` | Опыт пользователя |
| `level` | `users-unified.json` | `loadUsers()`, `UserPanel` | Уровень пользователя |
| `preferences` | `users-unified.json` | `loadUsers()`, `UserPanel` | Настройки пользователя (JSON) |
| `created_at` | `users-unified.json` | `loadUsers()` | Дата создания |
| `last_login` | `users-unified.json` | `loadUsers()`, `UserPanel` | Последний вход |

---

## 📖 ТАБЛИЦА: story_scenes

### Поля сюжетных сцен

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Уникальный идентификатор сцены |
| `title` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Название сцены |
| `description` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Описание сцены |
| `type` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Тип сцены |
| `content` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Содержимое сцены (JSON) |
| `conditions` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Условия сцены (JSON) |
| `effects` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Эффекты сцены (JSON) |
| `next_scenes` | `story-scenes-unified.json` | `loadStoryScenes()`, `StoryEditor` | Следующие сцены (JSON) |
| `created_at` | `story-scenes-unified.json` | `loadStoryScenes()` | Дата создания |
| `updated_at` | `story-scenes-unified.json` | `loadStoryScenes()` | Дата обновления |

---

## 🔧 ТАБЛИЦА: conditions

### Поля условий

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Уникальный идентификатор условия |
| `name` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Название условия |
| `description` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Описание условия |
| `type` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Тип условия |
| `expression` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Выражение условия |
| `parameters` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Параметры условия (JSON) |
| `examples` | `conditions-unified.json` | `loadConditions()`, `ConditionBuilder` | Примеры использования (JSON) |
| `created_at` | `conditions-unified.json` | `loadConditions()` | Дата создания |

---

## 🏭 ТАБЛИЦА: station_entities

### Поля сущностей станции

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Уникальный идентификатор сущности |
| `name` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Название сущности |
| `type` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Тип сущности |
| `description` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Описание сущности |
| `properties` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Свойства сущности (JSON) |
| `location` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Локация сущности |
| `status` | `station-entities.json` | `loadStationEntities()`, `StationPanel` | Статус сущности (active, inactive, maintenance) |
| `created_at` | `station-entities.json` | `loadStationEntities()` | Дата создания |
| `updated_at` | `station-entities.json` | `loadStationEntities()` | Дата обновления |

---

## 🤖 ТАБЛИЦА: character_ai_config

### Поля конфигурации ИИ

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `character-ai-config.ts` | `loadCharacterAIConfig()`, `CharacterAI` | Уникальный идентификатор конфигурации |
| `config_type` | `character-ai-config.ts` | `loadCharacterAIConfig()`, `CharacterAI` | Тип конфигурации (actions, tools, poses, etc.) |
| `config_data` | `character-ai-config.ts` | `loadCharacterAIConfig()`, `CharacterAI` | Данные конфигурации (JSON) |
| `version` | `character-ai-config.ts` | `loadCharacterAIConfig()`, `CharacterAI` | Версия конфигурации |
| `created_at` | `character-ai-config.ts` | `loadCharacterAIConfig()` | Дата создания |
| `updated_at` | `character-ai-config.ts` | `loadCharacterAIConfig()` | Дата обновления |

---

## 🧠 ТАБЛИЦА: character_memories

### Поля памяти персонажей

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Уникальный идентификатор памяти |
| `character_id` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Связь с персонажем |
| `type` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Тип памяти (episodic, semantic, emotional) |
| `content` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Содержимое памяти |
| `timestamp` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Временная метка |
| `intensity` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Интенсивность памяти (0-1) |
| `tags` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Теги памяти (JSON) |
| `related_characters` | `CharacterAI` | `CharacterAI`, `MemorySystem` | Связанные персонажи (JSON) |

---

## 🎓 ТАБЛИЦА: player_knowledge

### Поля знаний игроков

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Уникальный идентификатор знания |
| `player_id` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Связь с игроком |
| `character_id` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Связь с персонажем |
| `knowledge_type` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Тип знания (attributes, states, skills, etc.) |
| `knowledge_data` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Данные знания (JSON) |
| `analysis_count` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Количество анализов |
| `last_analyzed` | `CharacterAnalysis` | `CharacterAnalysis`, `KnowledgeSystem` | Последний анализ |

---

## 📊 ТАБЛИЦА: analysis_sessions

### Поля сессий анализа

| Поле БД | Функционально в конфигах | Используется в функциях | Описание |
|---------|-------------------------|------------------------|----------|
| `id` | `CharacterAnalysis` | `CharacterAnalysis`, `AnalysisSystem` | Уникальный идентификатор сессии |
| `player_id` | `CharacterAnalysis` | `CharacterAnalysis`, `AnalysisSystem` | Связь с игроком |
| `character_id` | `CharacterAnalysis` | `CharacterAnalysis`, `AnalysisSystem` | Связь с персонажем |
| `method` | `CharacterAnalysis` | `CharacterAnalysis`, `AnalysisSystem` | Метод анализа |
| `results` | `CharacterAnalysis` | `CharacterAnalysis`, `AnalysisSystem` | Результаты анализа (JSON) |
| `timestamp` | `CharacterAnalysis` | `CharacterAnalysis`, `AnalysisSystem` | Временная метка |

---

## 🔗 СВЯЗИ МЕЖДУ ТАБЛИЦАМИ

### Основные связи:

1. **characters** → **character_attributes** (1:N)
2. **characters** → **character_states** (1:N)
3. **characters** → **character_skills** (1:N)
4. **characters** → **character_fetishes** (1:N)
5. **characters** → **character_memories** (1:N)
6. **characters** → **player_knowledge** (1:N)
7. **characters** → **analysis_sessions** (1:N)
8. **users** → **player_knowledge** (1:N)
9. **users** → **analysis_sessions** (1:N)

### Внешние ключи:

- `character_attributes.character_id` → `characters.id`
- `character_states.character_id` → `characters.id`
- `character_skills.character_id` → `characters.id`
- `character_fetishes.character_id` → `characters.id`
- `character_memories.character_id` → `characters.id`
- `player_knowledge.player_id` → `users.id`
- `player_knowledge.character_id` → `characters.id`
- `analysis_sessions.player_id` → `users.id`
- `analysis_sessions.character_id` → `characters.id`

---

## 📝 ПРИМЕЧАНИЯ

1. **JSON поля** - содержат сложные структуры данных, которые в JSON конфигах хранились как объекты
2. **Временные метки** - автоматически обновляются при создании/изменении записей
3. **Индексы** - созданы для оптимизации поиска по часто используемым полям
4. **Валидация** - выполняется на уровне БД через ограничения и триггеры
5. **Кэширование** - реализовано на уровне приложения для часто запрашиваемых данных

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. **Создание БД** - применить схему из `database-schema.sql`
2. **Миграция данных** - запустить скрипты миграции
3. **Тестирование** - проверить все связи и функциональность
4. **Оптимизация** - добавить недостающие индексы
5. **Мониторинг** - настроить логирование и метрики
