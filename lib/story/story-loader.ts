import { SimplifiedStoryScene, StorySceneBinding } from '@/lib/unified-entities'
import { SimpleStoryConfig, SimpleScene } from '@/lib/simple-story-types'
import { SceneEventBinding } from '@/lib/story-binding-types'

// Кэширование конфигураций
const storyCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

// Основные типы данных
export interface StoryData {
  scenes: SimplifiedStoryScene[]
  simpleStories: SimpleStoryConfig[]
  eventBindings: SceneEventBinding[]
  templates: StoryTemplate[]
}

export interface StoryTemplate {
  id: string
  name: string
  description: string
  type: 'auction' | 'anomaly' | 'contract' | 'market' | 'training' | 'therapy'
  scenes: SimplifiedStoryScene[]
  metadata: {
    author: string
    version: string
    createdAt: string
    lastModified: string
    tags: string[]
  }
}

// Загрузка всех Story данных
export async function loadStoryData(): Promise<StoryData> {
  const cacheKey = 'all_story_data'
  const cached = storyCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📚 Story данные загружены из кэша')
    return cached.data
  }

  try {
    console.log('🔄 Загружаем Story данные...')
    
    // Загружаем unified данные
    const [scenesData, simpleStoriesData, eventBindingsData, templatesData] = await Promise.all([
      import('@/data/story-scenes-unified.json').then(m => m.default),
      import('@/data/story-bindings-examples.json').then(m => m.default),
      import('@/data/story-templates.json').then(m => m.default).catch(() => ({ templates: [] })),
      import('@/data/story-simple-examples.json').then(m => m.default).catch(() => ({ stories: [] }))
    ])

    const storyData: StoryData = {
      scenes: scenesData.scenes || [],
      simpleStories: simpleStoriesData.stories || [],
      eventBindings: eventBindingsData.bindings || [],
      templates: templatesData.templates || []
    }

    // Кэшируем результат
    storyCache.set(cacheKey, { data: storyData, timestamp: Date.now() })
    
    console.log('✅ Story данные загружены:', {
      scenes: storyData.scenes.length,
      simpleStories: storyData.simpleStories.length,
      eventBindings: storyData.eventBindings.length,
      templates: storyData.templates.length
    })

    return storyData
  } catch (error) {
    console.error('❌ Ошибка загрузки Story данных:', error)
    throw new Error('Не удалось загрузить Story данные')
  }
}

// Загрузка сцен по типу
export async function loadScenesByType(type: string): Promise<SimplifiedStoryScene[]> {
  const storyData = await loadStoryData()
  return storyData.scenes.filter(scene => scene.type === type)
}

// Загрузка простых историй
export async function loadSimpleStories(): Promise<SimpleStoryConfig[]> {
  const storyData = await loadStoryData()
  return storyData.simpleStories
}

// Загрузка привязок событий
export async function loadEventBindings(): Promise<SceneEventBinding[]> {
  const storyData = await loadStoryData()
  return storyData.eventBindings
}

// Загрузка шаблонов
export async function loadStoryTemplates(): Promise<StoryTemplate[]> {
  const storyData = await loadStoryData()
  return storyData.templates
}

// Загрузка шаблона по ID
export async function loadStoryTemplate(templateId: string): Promise<StoryTemplate | null> {
  const templates = await loadStoryTemplates()
  return templates.find(template => template.id === templateId) || null
}

// Создание новой сцены
export function createNewScene(type: string = 'auction'): SimplifiedStoryScene {
  return {
    id: `scene_${Date.now()}`,
    title: 'Новая сцена',
    description: 'Описание новой сцены',
    type: type as any,
    screens: [{
      id: 'screen_1',
      title: 'Начальный экран',
      description: 'Описание начального экрана',
      choices: [{
        id: 'choice_1',
        text: 'Продолжить',
        consequences: [],
        navigation: { type: 'end_scene' }
      }]
    }],
    bindings: [],
    metadata: {
      author: 'user',
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  }
}

// Создание новой простой истории
export function createNewSimpleStory(): SimpleStoryConfig {
  return {
    id: `story_${Date.now()}`,
    title: 'Новая история',
    description: 'Описание новой истории',
    scenes: [{
      id: `scene_${Date.now()}`,
      title: 'Начальная сцена',
      description: 'Описание начальной сцены',
      content: {
        text: 'Текст начальной сцены...'
      },
      choices: [{
        id: `choice_${Date.now()}`,
        text: 'Продолжить',
        effects: [],
        nextScene: undefined,
        endScene: true
      }]
    }],
    metadata: {
      author: 'user',
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  }
}

// Создание новой привязки события
export function createNewEventBinding(
  eventType: 'auction' | 'anomaly',
  sceneId: string
): SceneEventBinding {
  return {
    id: `binding_${Date.now()}`,
    eventType,
    sceneId,
    conditions: [],
    probability: 50,
    priority: 1,
    isBaseChance: false,
    metadata: {
      source: 'manual',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  }
}

// Сохранение данных (заглушка - в реальном проекте здесь будет API)
export async function saveStoryData(data: Partial<StoryData>): Promise<void> {
  console.log('💾 Сохранение Story данных:', data)
  
  // В реальном проекте здесь будет отправка на сервер
  // await fetch('/api/story/save', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data)
  // })
  
  // Очищаем кэш после сохранения
  storyCache.clear()
}

// Очистка кэша
export function clearStoryCache(): void {
  storyCache.clear()
  console.log('🧹 Кэш Story данных очищен')
}

// Утилиты для работы с сценами
export const StoryUtils = {
  // Получить сцену по ID
  getSceneById: (scenes: SimplifiedStoryScene[], sceneId: string): SimplifiedStoryScene | null => {
    return scenes.find(scene => scene.id === sceneId) || null
  },

  // Получить сцены по типу
  getScenesByType: (scenes: SimplifiedStoryScene[], type: string): SimplifiedStoryScene[] => {
    return scenes.filter(scene => scene.type === type)
  },

  // Обновить сцену
  updateScene: (scenes: SimplifiedStoryScene[], sceneId: string, updates: Partial<SimplifiedStoryScene>): SimplifiedStoryScene[] => {
    return scenes.map(scene => 
      scene.id === sceneId 
        ? { 
            ...scene, 
            ...updates, 
            metadata: { 
              ...scene.metadata, 
              lastModified: new Date().toISOString() 
            } 
          }
        : scene
    )
  },

  // Удалить сцену
  deleteScene: (scenes: SimplifiedStoryScene[], sceneId: string): SimplifiedStoryScene[] => {
    return scenes.filter(scene => scene.id !== sceneId)
  },

  // Добавить сцену
  addScene: (scenes: SimplifiedStoryScene[], newScene: SimplifiedStoryScene): SimplifiedStoryScene[] => {
    return [...scenes, newScene]
  },

  // Валидация сцены
  validateScene: (scene: SimplifiedStoryScene): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!scene.title.trim()) {
      errors.push('Название сцены обязательно')
    }

    if (!scene.description.trim()) {
      errors.push('Описание сцены обязательно')
    }

    if (!scene.screens || scene.screens.length === 0) {
      errors.push('Сцена должна содержать хотя бы один экран')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// Утилиты для работы с простыми историями
export const SimpleStoryUtils = {
  // Получить историю по ID
  getStoryById: (stories: SimpleStoryConfig[], storyId: string): SimpleStoryConfig | null => {
    return stories.find(story => story.id === storyId) || null
  },

  // Обновить историю
  updateStory: (stories: SimpleStoryConfig[], storyId: string, updates: Partial<SimpleStoryConfig>): SimpleStoryConfig[] => {
    return stories.map(story => 
      story.id === storyId 
        ? { 
            ...story, 
            ...updates, 
            metadata: { 
              ...story.metadata, 
              lastModified: new Date().toISOString() 
            } 
          }
        : story
    )
  },

  // Удалить историю
  deleteStory: (stories: SimpleStoryConfig[], storyId: string): SimpleStoryConfig[] => {
    return stories.filter(story => story.id !== storyId)
  },

  // Добавить историю
  addStory: (stories: SimpleStoryConfig[], newStory: SimpleStoryConfig): SimpleStoryConfig[] => {
    return [...stories, newStory]
  },

  // Валидация истории
  validateStory: (story: SimpleStoryConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!story.title.trim()) {
      errors.push('Название истории обязательно')
    }

    if (!story.description.trim()) {
      errors.push('Описание истории обязательно')
    }

    if (!story.scenes || story.scenes.length === 0) {
      errors.push('История должна содержать хотя бы одну сцену')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

