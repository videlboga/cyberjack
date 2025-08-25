import fs from 'fs'
import path from 'path'

interface UnifiedCharacter {
  id: string
  name: string
  rank: string
  price: number
  description: string
  status: string
  traits: string[]
  preferences: any
  condition: any
  history: any
  states?: any
  metadata?: any
  attributes?: any
  skills?: any
  fetishes?: any
}

interface UnifiedCharactersData {
  characters: UnifiedCharacter[]
  templates: any
  config?: any
}

function generateRandomValue(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function migrateUnifiedCharacters(): void {
  console.log('🔄 Начинаем миграцию unified персонажей...')
  
  // Читаем существующие данные
  const charactersPath = path.join(process.cwd(), 'data', 'characters-unified.json')
  const charactersData: UnifiedCharactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))
  
  // Обновляем каждого персонажа
  charactersData.characters = charactersData.characters.map((character: UnifiedCharacter) => {
    console.log(`📝 Обновляем персонажа: ${character.name}`)
    
    // Добавляем недостающие атрибуты
    const updatedAttributes = {
      strength: character.attributes?.strength ?? generateRandomValue(1, 10),
      empathy: character.attributes?.empathy ?? generateRandomValue(1, 10),
      intelligence: character.attributes?.intelligence ?? generateRandomValue(1, 10),
      temperament: character.attributes?.temperament ?? generateRandomValue(1, 10),
      grit: character.attributes?.grit ?? generateRandomValue(1, 10),
      ego: character.attributes?.ego ?? generateRandomValue(1, 10),
      loyalty: character.attributes?.loyalty ?? generateRandomValue(1, 10),
      obedience: character.attributes?.obedience ?? generateRandomValue(1, 10),
      resistance: character.attributes?.resistance ?? generateRandomValue(1, 10),
      creativity: character.attributes?.creativity ?? generateRandomValue(1, 10),
      endurance: character.attributes?.endurance ?? generateRandomValue(1, 10),
      sensitivity: character.attributes?.sensitivity ?? generateRandomValue(1, 10),
      flexibility: character.attributes?.flexibility ?? generateRandomValue(1, 10),
      emotional_stability: character.attributes?.emotional_stability ?? generateRandomValue(1, 10),
      adaptability: character.attributes?.adaptability ?? generateRandomValue(1, 10),
      sociability: character.attributes?.sociability ?? generateRandomValue(1, 10),
      dominance: character.attributes?.dominance ?? generateRandomValue(1, 10),
      self_esteem: character.attributes?.self_esteem ?? generateRandomValue(1, 10),
      optimism: character.attributes?.optimism ?? generateRandomValue(1, 10),
      curiosity: character.attributes?.curiosity ?? generateRandomValue(1, 10),
      sexual_experience: character.attributes?.sexual_experience ?? generateRandomValue(1, 10),
      dependency: character.attributes?.dependency ?? generateRandomValue(1, 10)
    }
    
    // Добавляем недостающие состояния
    const updatedCondition = {
      health: character.condition?.health ?? generateRandomValue(0, 100),
      mental_state: character.condition?.mental_state ?? generateRandomValue(0, 100),
      stress: character.condition?.stress ?? generateRandomValue(0, 100),
      fatigue: character.condition?.fatigue ?? generateRandomValue(0, 100),
      mood: character.condition?.mood ?? generateRandomValue(0, 100),
      fear: character.condition?.fear ?? generateRandomValue(0, 100),
      despair: character.condition?.despair ?? generateRandomValue(0, 100),
      devotion: character.condition?.devotion ?? generateRandomValue(0, 100),
      trust: character.condition?.trust ?? generateRandomValue(0, 100),
      relationship: character.condition?.relationship ?? generateRandomValue(0, 100),
      pleasure: character.condition?.pleasure ?? generateRandomValue(0, 100),
      pain: character.condition?.pain ?? generateRandomValue(0, 100),
      arousal: character.condition?.arousal ?? generateRandomValue(0, 100),
      anxiety: character.condition?.anxiety ?? generateRandomValue(0, 100),
      happiness: character.condition?.happiness ?? generateRandomValue(0, 100),
      sadness: character.condition?.sadness ?? generateRandomValue(0, 100),
      anger: character.condition?.anger ?? generateRandomValue(0, 100),
      shame: character.condition?.shame ?? generateRandomValue(0, 100),
      guilt: character.condition?.guilt ?? generateRandomValue(0, 100),
      pride: character.condition?.pride ?? generateRandomValue(0, 100),
      humiliation: character.condition?.humiliation ?? generateRandomValue(0, 100),
      submission: character.condition?.submission ?? generateRandomValue(0, 100),
      dominance: character.condition?.dominance ?? generateRandomValue(0, 100),
      vulnerability: character.condition?.vulnerability ?? generateRandomValue(0, 100),
      confidence: character.condition?.confidence ?? generateRandomValue(0, 100),
      helplessness: character.condition?.helplessness ?? generateRandomValue(0, 100),
      entitlement: character.condition?.entitlement ?? generateRandomValue(0, 100),
      awareness: character.condition?.awareness ?? generateRandomValue(0, 100),
      routine: character.condition?.routine ?? generateRandomValue(0, 100),
      compliance: character.condition?.compliance ?? generateRandomValue(0, 100),
      sensuality: character.condition?.sensuality ?? generateRandomValue(0, 100),
      sensory_overload: character.condition?.sensory_overload ?? generateRandomValue(0, 100)
    }
    
    // Генерируем фетиши на основе атрибутов
    const fetishes = {
      bdsm: Math.round((updatedAttributes.obedience + (updatedAttributes.dominance ?? 5)) / 2),
      humiliation: Math.round(((updatedAttributes.self_esteem ?? 5) + (updatedAttributes.ego ?? 5)) / 2),
      bondage: Math.round(((updatedAttributes.flexibility ?? 5) + (updatedAttributes.sensitivity ?? 5)) / 2),
      masochism: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.endurance ?? 5)) / 2),
      sadism: Math.round(((updatedAttributes.dominance ?? 5) + updatedAttributes.ego) / 2),
      voyeurism: Math.round(((updatedAttributes.curiosity ?? 5) + (updatedAttributes.sensitivity ?? 5)) / 2),
      exhibitionism: Math.round((updatedAttributes.ego + (updatedAttributes.sociability ?? 5)) / 2),
      roleplay: Math.round(((updatedAttributes.creativity ?? 5) + (updatedAttributes.adaptability ?? 5)) / 2),
      sensory_deprivation: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.curiosity ?? 5)) / 2),
      sensory_overload: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.endurance ?? 5)) / 2),
      electricity: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.endurance ?? 5)) / 2),
      vibration: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.flexibility ?? 5)) / 2),
      temperature: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.endurance ?? 5)) / 2),
      pressure: Math.round(((updatedAttributes.endurance ?? 5) + (updatedAttributes.flexibility ?? 5)) / 2),
      tickling: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.flexibility ?? 5)) / 2),
      feet: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.flexibility ?? 5)) / 2),
      hands: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.flexibility ?? 5)) / 2),
      breasts: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.sexual_experience ?? 5)) / 2),
      anal: Math.round(((updatedAttributes.flexibility ?? 5) + (updatedAttributes.sexual_experience ?? 5)) / 2),
      latex: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.sociability ?? 5)) / 2),
      leather: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.sociability ?? 5)) / 2),
      silk: Math.round(((updatedAttributes.sensitivity ?? 5) + (updatedAttributes.sociability ?? 5)) / 2),
      rope: Math.round(((updatedAttributes.flexibility ?? 5) + updatedAttributes.obedience) / 2),
      uniform: Math.round((updatedAttributes.obedience + (updatedAttributes.sociability ?? 5)) / 2),
      age_play: Math.round(((updatedAttributes.creativity ?? 5) + (updatedAttributes.adaptability ?? 5)) / 2),
      pregnancy: Math.round(((updatedAttributes.sexual_experience ?? 5) + updatedAttributes.empathy) / 2),
      lactation: Math.round(((updatedAttributes.sexual_experience ?? 5) + updatedAttributes.empathy) / 2)
    }
    
    return {
      ...character,
      attributes: updatedAttributes,
      condition: updatedCondition,
      fetishes
    }
  })
  
  // Обновляем шаблоны
  if (charactersData.templates) {
    Object.keys(charactersData.templates).forEach(templateKey => {
      if (Array.isArray(charactersData.templates[templateKey])) {
        charactersData.templates[templateKey] = charactersData.templates[templateKey].map((template: any) => {
          console.log(`📝 Обновляем шаблон: ${template.name}`)
          
          const updatedTemplateAttributes = {
            strength: template.attributes?.strength ?? generateRandomValue(1, 10),
            empathy: template.attributes?.empathy ?? generateRandomValue(1, 10),
            intelligence: template.attributes?.intelligence ?? generateRandomValue(1, 10),
            temperament: template.attributes?.temperament ?? generateRandomValue(1, 10),
            grit: template.attributes?.grit ?? generateRandomValue(1, 10),
            ego: template.attributes?.ego ?? generateRandomValue(1, 10),
            loyalty: template.attributes?.loyalty ?? generateRandomValue(1, 10),
            obedience: template.attributes?.obedience ?? generateRandomValue(1, 10),
            resistance: template.attributes?.resistance ?? generateRandomValue(1, 10),
            creativity: template.attributes?.creativity ?? generateRandomValue(1, 10),
            endurance: template.attributes?.endurance ?? generateRandomValue(1, 10),
            sensitivity: template.attributes?.sensitivity ?? generateRandomValue(1, 10),
            flexibility: template.attributes?.flexibility ?? generateRandomValue(1, 10),
            emotional_stability: template.attributes?.emotional_stability ?? generateRandomValue(1, 10),
            adaptability: template.attributes?.adaptability ?? generateRandomValue(1, 10),
            sociability: template.attributes?.sociability ?? generateRandomValue(1, 10),
            dominance: template.attributes?.dominance ?? generateRandomValue(1, 10),
            self_esteem: template.attributes?.self_esteem ?? generateRandomValue(1, 10),
            optimism: template.attributes?.optimism ?? generateRandomValue(1, 10),
            curiosity: template.attributes?.curiosity ?? generateRandomValue(1, 10),
            sexual_experience: template.attributes?.sexual_experience ?? generateRandomValue(1, 10),
            dependency: template.attributes?.dependency ?? generateRandomValue(1, 10)
          }
          
          return {
            ...template,
            attributes: updatedTemplateAttributes
          }
        })
      }
    })
  }
  
  // Сохраняем обновленные данные
  fs.writeFileSync(charactersPath, JSON.stringify(charactersData, null, 2), 'utf8')
  console.log('✅ Миграция unified персонажей завершена!')
}

// Запускаем миграцию
try {
  migrateUnifiedCharacters()
  console.log('🎉 Миграция unified данных завершена успешно!')
} catch (error) {
  console.error('❌ Ошибка при миграции:', error)
  process.exit(1)
}
