-- ===== СХЕМА БАЗЫ ДАННЫХ CYBERJACK =====
-- Замена JSON конфигов на реляционную БД

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

-- События
CREATE TABLE events (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    probability DECIMAL(3,2) DEFAULT 0.1,
    effects JSONB,
    trigger_type VARCHAR(50) DEFAULT 'random',
    conditions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Оборудование
CREATE TABLE equipment (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    stats JSONB,
    enabled BOOLEAN DEFAULT true,
    target_talents JSONB,
    power_level INTEGER DEFAULT 0,
    max_power_level INTEGER DEFAULT 100,
    energy_consumption INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Пользователи
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'player',
    credits INTEGER DEFAULT 1000,
    experience INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    type VARCHAR(50) NOT NULL, -- episodic, semantic, emotional
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    intensity DECIMAL(3,2) DEFAULT 0.5,
    tags JSONB,
    related_characters JSONB,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Знания игроков о персонажах
CREATE TABLE player_knowledge (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    character_id VARCHAR(255) NOT NULL,
    knowledge_type VARCHAR(50) NOT NULL, -- attributes, states, skills, etc.
    knowledge_data JSONB NOT NULL,
    analysis_count INTEGER DEFAULT 0,
    last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE(player_id, character_id, knowledge_type)
);

-- Сессии анализа
CREATE TABLE analysis_sessions (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    character_id VARCHAR(255) NOT NULL,
    method VARCHAR(100) NOT NULL,
    results JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- ===== ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ =====

-- Индексы для быстрого поиска
CREATE INDEX idx_characters_rank ON characters(rank);
CREATE INDEX idx_characters_status ON characters(status);
CREATE INDEX idx_characters_location ON characters(location);
CREATE INDEX idx_character_attributes_category ON character_attributes(category);
CREATE INDEX idx_character_skills_level ON character_skills(level);
CREATE INDEX idx_actions_category ON actions(category);
CREATE INDEX idx_actions_type ON actions(type);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_story_scenes_type ON story_scenes(type);
CREATE INDEX idx_character_memories_type ON character_memories(type);
CREATE INDEX idx_character_memories_timestamp ON character_memories(timestamp);

-- Составные индексы
CREATE INDEX idx_character_attributes_character_category ON character_attributes(character_id, category);
CREATE INDEX idx_character_skills_character_level ON character_skills(character_id, level);
CREATE INDEX idx_player_knowledge_player_character ON player_knowledge(player_id, character_id);
CREATE INDEX idx_analysis_sessions_player_character ON analysis_sessions(player_id, character_id);

-- ===== ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ =====

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применяем триггеры к таблицам с updated_at
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_story_scenes_updated_at BEFORE UPDATE ON story_scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_station_entities_updated_at BEFORE UPDATE ON station_entities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_ai_config_updated_at BEFORE UPDATE ON character_ai_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
