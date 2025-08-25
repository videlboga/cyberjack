import fs from 'fs'
import path from 'path'

interface AssetAttributes {
  strength: number
  empathy: number
  intelligence: number
  temperament: number
  grit: number
  ego: number
  loyalty: number
  obedience: number
  resistance: number
  creativity?: number
  endurance?: number
  sensitivity?: number
  flexibility?: number
  emotional_stability?: number
  adaptability?: number
  sociability?: number
  dominance?: number
  self_esteem?: number
  optimism?: number
  curiosity?: number
  sexual_experience?: number
  dependency?: number
}

interface AssetCondition {
  health: number
  mental_state: number
  stress: number
  fatigue: number
  mood?: number
  fear?: number
  despair?: number
  devotion?: number
  trust?: number
  relationship?: number
  pleasure?: number
  pain?: number
  arousal?: number
  anxiety?: number
  happiness?: number
  sadness?: number
  anger?: number
  shame?: number
  guilt?: number
  pride?: number
  humiliation?: number
  submission?: number
  dominance?: number
  vulnerability?: number
  confidence?: number
  helplessness?: number
  entitlement?: number
  awareness?: number
  routine?: number
  compliance?: number
  sensuality?: number
  sensory_overload?: number
}

interface AssetFetishes {
  bdsm?: number
  humiliation?: number
  bondage?: number
  masochism?: number
  sadism?: number
  voyeurism?: number
  exhibitionism?: number
  roleplay?: number
  sensory_deprivation?: number
  sensory_overload?: number
  electricity?: number
  vibration?: number
  temperature?: number
  pressure?: number
  tickling?: number
  feet?: number
  hands?: number
  breasts?: number
  anal?: number
  latex?: number
  leather?: number
  silk?: number
  rope?: number
  uniform?: number
  age_play?: number
  pregnancy?: number
  lactation?: number
  [key: string]: number | undefined
}

interface GameAsset {
  id: string
  name: string
  rank: string
  avatar?: string
  price: number
  specialization: string
  description: string
  status?: string
  owner?: string | null
  location?: string
  attributes: AssetAttributes
  skills: any
  fetishes?: AssetFetishes
  traits: string[]
  preferences: any
  condition: AssetCondition
  history: any
}

function generateRandomValue(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function migrateAssets(): void {
  console.log('🔄 Начинаем миграцию атрибутов...')
  
  // Читаем существующие данные
  const assetsPath = path.join(process.cwd(), 'data', 'assets.json')
  const assetsData = JSON.parse(fs.readFileSync(assetsPath, 'utf8'))
  
  // Обновляем каждый актив
  assetsData.assets = assetsData.assets.map((asset: GameAsset) => {
    console.log(`📝 Обновляем актив: ${asset.name}`)
    
    // Добавляем недостающие атрибуты
    const updatedAttributes: AssetAttributes = {
      ...asset.attributes,
      creativity: asset.attributes.creativity ?? generateRandomValue(1, 10),
      endurance: asset.attributes.endurance ?? generateRandomValue(1, 10),
      sensitivity: asset.attributes.sensitivity ?? generateRandomValue(1, 10),
      flexibility: asset.attributes.flexibility ?? generateRandomValue(1, 10),
      emotional_stability: asset.attributes.emotional_stability ?? generateRandomValue(1, 10),
      adaptability: asset.attributes.adaptability ?? generateRandomValue(1, 10),
      sociability: asset.attributes.sociability ?? generateRandomValue(1, 10),
      dominance: asset.attributes.dominance ?? generateRandomValue(1, 10),
      self_esteem: asset.attributes.self_esteem ?? generateRandomValue(1, 10),
      optimism: asset.attributes.optimism ?? generateRandomValue(1, 10),
      curiosity: asset.attributes.curiosity ?? generateRandomValue(1, 10),
      sexual_experience: asset.attributes.sexual_experience ?? generateRandomValue(1, 10),
      dependency: asset.attributes.dependency ?? generateRandomValue(1, 10)
    }
    
    // Добавляем недостающие состояния
    const updatedCondition: AssetCondition = {
      ...asset.condition,
      mood: asset.condition.mood ?? generateRandomValue(0, 100),
      fear: asset.condition.fear ?? generateRandomValue(0, 100),
      despair: asset.condition.despair ?? generateRandomValue(0, 100),
      devotion: asset.condition.devotion ?? generateRandomValue(0, 100),
      trust: asset.condition.trust ?? generateRandomValue(0, 100),
      relationship: asset.condition.relationship ?? generateRandomValue(0, 100),
      pleasure: asset.condition.pleasure ?? generateRandomValue(0, 100),
      pain: asset.condition.pain ?? generateRandomValue(0, 100),
      arousal: asset.condition.arousal ?? generateRandomValue(0, 100),
      anxiety: asset.condition.anxiety ?? generateRandomValue(0, 100),
      happiness: asset.condition.happiness ?? generateRandomValue(0, 100),
      sadness: asset.condition.sadness ?? generateRandomValue(0, 100),
      anger: asset.condition.anger ?? generateRandomValue(0, 100),
      shame: asset.condition.shame ?? generateRandomValue(0, 100),
      guilt: asset.condition.guilt ?? generateRandomValue(0, 100),
      pride: asset.condition.pride ?? generateRandomValue(0, 100),
      humiliation: asset.condition.humiliation ?? generateRandomValue(0, 100),
      submission: asset.condition.submission ?? generateRandomValue(0, 100),
      dominance: asset.condition.dominance ?? generateRandomValue(0, 100),
      vulnerability: asset.condition.vulnerability ?? generateRandomValue(0, 100),
      confidence: asset.condition.confidence ?? generateRandomValue(0, 100),
      helplessness: asset.condition.helplessness ?? generateRandomValue(0, 100),
      entitlement: asset.condition.entitlement ?? generateRandomValue(0, 100),
      awareness: asset.condition.awareness ?? generateRandomValue(0, 100),
      routine: asset.condition.routine ?? generateRandomValue(0, 100),
      compliance: asset.condition.compliance ?? generateRandomValue(0, 100),
      sensuality: asset.condition.sensuality ?? generateRandomValue(0, 100),
      sensory_overload: asset.condition.sensory_overload ?? generateRandomValue(0, 100)
    }
    
         // Генерируем фетиши на основе существующих атрибутов
     const fetishes: AssetFetishes = {
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
      ...asset,
      attributes: updatedAttributes,
      condition: updatedCondition,
      fetishes
    }
  })
  
  // Сохраняем обновленные данные
  fs.writeFileSync(assetsPath, JSON.stringify(assetsData, null, 2), 'utf8')
  console.log('✅ Миграция атрибутов завершена!')
}

function migrateCharacters(): void {
  console.log('🔄 Начинаем миграцию персонажей...')
  
  // Читаем существующие данные
  const charactersPath = path.join(process.cwd(), 'data', 'characters.json')
  const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))
  
  // Обновляем каждого персонажа
  Object.keys(charactersData.characters).forEach(charId => {
    const character = charactersData.characters[charId]
    console.log(`📝 Обновляем персонажа: ${character.name}`)
    
    // Добавляем недостающие атрибуты в stats
    if (!character.stats.physical.endurance) {
      character.stats.physical.endurance = generateRandomValue(1, 10)
    }
    if (!character.stats.physical.sensitivity) {
      character.stats.physical.sensitivity = generateRandomValue(1, 10)
    }
    if (!character.stats.physical.flexibility) {
      character.stats.physical.flexibility = generateRandomValue(1, 10)
    }
    
    if (!character.stats.psychological.emotionalStability) {
      character.stats.psychological.emotionalStability = generateRandomValue(1, 10)
    }
    if (!character.stats.psychological.adaptability) {
      character.stats.psychological.adaptability = generateRandomValue(1, 10)
    }
    
    if (!character.stats.social.sociability) {
      character.stats.social.sociability = generateRandomValue(1, 10)
    }
    if (!character.stats.social.empathy) {
      character.stats.social.empathy = generateRandomValue(1, 10)
    }
    if (!character.stats.social.dominance) {
      character.stats.social.dominance = generateRandomValue(1, 10)
    }
    
    if (!character.stats.personality.selfEsteem) {
      character.stats.personality.selfEsteem = generateRandomValue(1, 10)
    }
    if (!character.stats.personality.optimism) {
      character.stats.personality.optimism = generateRandomValue(1, 10)
    }
    if (!character.stats.personality.curiosity) {
      character.stats.personality.curiosity = generateRandomValue(1, 10)
    }
    
    if (!character.stats.special.sexualExperience) {
      character.stats.special.sexualExperience = generateRandomValue(1, 10)
    }
    if (!character.stats.special.resistance) {
      character.stats.special.resistance = generateRandomValue(1, 10)
    }
    if (!character.stats.special.dependency) {
      character.stats.special.dependency = generateRandomValue(1, 10)
    }
    if (!character.stats.special.fetishSensitivity) {
      character.stats.special.fetishSensitivity = generateRandomValue(1, 10)
    }
    if (!character.stats.special.fetishDiscovery) {
      character.stats.special.fetishDiscovery = generateRandomValue(1, 10)
    }
  })
  
  // Сохраняем обновленные данные
  fs.writeFileSync(charactersPath, JSON.stringify(charactersData, null, 2), 'utf8')
  console.log('✅ Миграция персонажей завершена!')
}

// Запускаем миграцию
try {
  migrateAssets()
  migrateCharacters()
  console.log('🎉 Все миграции завершены успешно!')
} catch (error) {
  console.error('❌ Ошибка при миграции:', error)
  process.exit(1)
}

export { migrateAssets, migrateCharacters }
