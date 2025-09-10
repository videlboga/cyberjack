-- ===== ОБНОВЛЕННАЯ СХЕМА БАЗЫ ДАННЫХ CYBERJACK =====
-- Исправленная схема для корректной миграции данных

-- ===== ОСНОВНЫЕ ТАБЛИЦЫ =====

-- Персонажи/Активы
CREATE TABLE characters (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rank VARCHAR(10) NOT NULL DEFAULT 'F',
    status VARCHAR(50) NOT NULL DEFAULT 'available',
    location VARCHAR(50) NOT NULL DEFAULT 'talent_exchange',
    source VARCHAR(50) NOT NULL DEFAULT 'market',
    archetype VARCHAR(100),
    description TEXT,
    avatar VARCHAR(10),
    price INTEGER DEFAULT 0,
    specialization VARCHAR(255),
    emotional_state VARCHAR(50) DEFAULT 'neutral',
    communication_style VARCHAR(50) DEFAULT 'neutral',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_interactions INTEGER DEFAULT 0,
    metadata JSONB
);

-- Атрибуты персонажей
CREATE TABLE character_attributes (
    character_id VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- physical, psychological, social, personality, special
    attribute_name VARCHAR(100) NOT NULL,
    value DECIMAL(5,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, category, attribute_name),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Состояния персонажей
CREATE TABLE character_states (
    character_id VARCHAR(255) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    value DECIMAL(5,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, state_name),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Навыки персонажей
CREATE TABLE character_skills (
    character_id VARCHAR(255) NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, skill_name),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Фетиши персонажей
CREATE TABLE character_fetishes (
    character_id VARCHAR(255) NOT NULL,
    fetish_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- primary, secondary, discovered, hidden
    intensity DECIMAL(5,2) DEFAULT 0,
    PRIMARY KEY (character_id, fetish_name, category),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Действия
CREATE TABLE actions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    cost INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 60,
    risk_level VARCHAR(20) DEFAULT 'low',
    effects JSONB,
    requirements JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Контракты
CREATE TABLE contracts (
    id VARCHAR(255) PRIMARY KEY,
    client VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements JSONB,
    reward INTEGER DEFAULT 0,
    deadline INTEGER DEFAULT 7,
    kpi JSONB,
    assigned_talents JSONB,
    status VARCHAR(50) DEFAULT 'available',
    story_scenes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- События (ИСПРАВЛЕННАЯ СХЕМА)
CREATE TABLE events (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    probability DECIMAL(3,2) DEFAULT 0.1,
    effects JSONB,
    duration INTEGER DEFAULT 1,
    story_scenes JSONB,
    conditions JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Оборудование (ИСПРАВЛЕННАЯ СХЕМА)
CREATE TABLE equipment (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    slot VARCHAR(100) NOT NULL,
    description TEXT,
    effects JSONB,
    removable BOOLEAN DEFAULT true,
    power_settings JSONB,
    modes JSONB,
    progressive_effects JSONB,
    requirements JSONB,
    cost INTEGER DEFAULT 0,
    rarity VARCHAR(50) DEFAULT 'common',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Пользователи (ИСПРАВЛЕННАЯ СХЕМА)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    account JSONB,
    characters JSONB,
    user_equipment JSONB,
    attributes JSONB,
    stats JSONB,
    preferences JSONB,
    metadata JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Сюжетные сцены
CREATE TABLE story_scenes (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    content JSONB,
    conditions JSONB,
    effects JSONB,
    next_scenes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Условия
CREATE TABLE conditions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    expression TEXT NOT NULL,
    parameters JSONB,
    examples JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Сущности станции
CREATE TABLE station_entities (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    properties JSONB,
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Конфигурация ИИ персонажей
CREATE TABLE character_ai_config (
    id VARCHAR(255) PRIMARY KEY,
    config_type VARCHAR(100) NOT NULL, -- actions, tools, poses, etc.
    config_data JSONB NOT NULL,
    version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== СВЯЗАННЫЕ ТАБЛИЦЫ =====

-- Память персонажей
CREATE TABLE character_memories (
    id VARCHAR(255) PRIMARY KEY,
    character_id VARCHAR(255) NOT NULL,
    memory_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    intensity INTEGER DEFAULT 1,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Знания игроков о персонажах
CREATE TABLE player_knowledge (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    character_id VARCHAR(255) NOT NULL,
    knowledge_type VARCHAR(50) NOT NULL,
    revealed_attributes JSONB,
    discovered_skills JSONB,
    known_fetishes JSONB,
    interaction_history JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Сессии анализа
CREATE TABLE analysis_sessions (
    id VARCHAR(255) PRIMARY KEY,
    character_id VARCHAR(255) NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    session_type VARCHAR(50) NOT NULL,
    analysis_data JSONB,
    results JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ =====

-- Индексы для персонажей
CREATE INDEX idx_characters_rank ON characters(rank);
CREATE INDEX idx_characters_status ON characters(status);
CREATE INDEX idx_characters_location ON characters(location);
CREATE INDEX idx_characters_archetype ON characters(archetype);

-- Индексы для действий
CREATE INDEX idx_actions_category ON actions(category);
CREATE INDEX idx_actions_type ON actions(type);
CREATE INDEX idx_actions_risk_level ON actions(risk_level);
CREATE INDEX idx_actions_enabled ON actions(enabled);

-- Индексы для контрактов
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_client ON contracts(client);
CREATE INDEX idx_contracts_reward ON contracts(reward);

-- Индексы для событий
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_enabled ON events(enabled);

-- Индексы для оборудования
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_slot ON equipment(slot);
CREATE INDEX idx_equipment_enabled ON equipment(enabled);

-- Индексы для пользователей
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ===== ТРИГГЕРЫ ДЛЯ ОБНОВЛЕНИЯ TIMESTAMP =====

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для обновления updated_at
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_story_scenes_updated_at BEFORE UPDATE ON story_scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_station_entities_updated_at BEFORE UPDATE ON station_entities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_ai_config_updated_at BEFORE UPDATE ON character_ai_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
