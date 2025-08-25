'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Character } from '@/lib/character/types'
import { loadUnifiedConfigWithAdapter } from '@/lib/unified-config-adapter'

interface GameConfig {
  characters?: {
    characters: Character[]
    templates: Record<string, any>
    config: {
      skillCategories: Record<string, any>
      fetishCategories: Record<string, any>
    }
  }
  characterAI?: any
}

export default function CharacterManagerProd() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const [activeTab, setActiveTab] = useState("characters")
  const [loading, setLoading] = useState(true)

  // Загрузка конфигурации
  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log('🔄 Загрузка конфигурации...')
        const config = await loadUnifiedConfigWithAdapter()
        setGameConfig(config)
        
        // Заполнение characters из конфигурации
        console.log('🔄 Заполняем characters из конфигурации...')
        const charactersFromConfig = config.characters?.characters || []
        console.log('✅ Characters заполнены из конфигурации:', charactersFromConfig)
        setCharacters(charactersFromConfig)
        
        setLoading(false)
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигурации:', error)
        setLoading(false)
      }
    }
    
    loadConfig()
  }, [])

  // Обработчик выбора персонажа
  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character)
  }

  // Получение цвета для эмоционального состояния
  const getEmotionalStateColor = (state: string) => {
    switch (state) {
      case 'happy': return 'text-green-600'
      case 'sad': return 'text-blue-600'
      case 'fearful': return 'text-red-600'
      case 'despairing': return 'text-purple-600'
      case 'devoted': return 'text-pink-600'
      case 'submissive': return 'text-gray-600'
      case 'dominant': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  // Получение эмодзи для эмоционального состояния
  const getEmotionalStateEmoji = (state: string) => {
    switch (state) {
      case 'happy': return '😊'
      case 'sad': return '😔'
      case 'fearful': return '😨'
      case 'despairing': return '😞'
      case 'devoted': return '🥰'
      case 'submissive': return '🙇‍♀️'
      case 'dominant': return '😏'
      default: return '😐'
    }
  }

  // Получение цвета для архетипа
  const getArchetypeColor = (archetype: string) => {
    switch (archetype) {
      case 'talent_exchange': return 'bg-blue-100 text-blue-800'
      case 'void_rescue': return 'bg-purple-100 text-purple-800'
      case 'corporate_contract': return 'bg-green-100 text-green-800'
      case 'submissive': return 'bg-pink-100 text-pink-800'
      case 'dominant': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Загрузка персонажей...</p>
        </div>
      </div>
    )
  }

    return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Character Manager</h1>
        <p className="text-gray-600">Управление персонажами в новой системе Character AI</p>
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="characters">Персонажи ({characters.length})</TabsTrigger>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
          <TabsTrigger value="categories">Категории</TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((character) => (
              <Card 
                key={character.id} 
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedCharacter?.id === character.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleCharacterSelect(character)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" />
                        <AvatarFallback>{character.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{character.name}</CardTitle>
                        <Badge className={getArchetypeColor(character.archetype)}>
                          {character.archetype}
                        </Badge>
                </div>
            </div>
                    <div className="text-right">
                      <div className={`text-sm ${getEmotionalStateColor(character.emotionalState)}`}>
                        {getEmotionalStateEmoji(character.emotionalState)}
          </div>
            </div>
          </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {character.description}
                  </p>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Физическая выносливость:</span>
                      <span className="font-medium">{character.stats.physical.endurance}/10</span>
                        </div>
                    <Progress value={character.stats.physical.endurance * 10} className="h-2" />
                    
                    <div className="flex justify-between text-sm">
                      <span>Эмоциональная стабильность:</span>
                      <span className="font-medium">{character.stats.psychological.emotionalStability}/10</span>
                      </div>
                    <Progress value={character.stats.psychological.emotionalStability * 10} className="h-2" />
                    
                    <div className="flex justify-between text-sm">
                      <span>Интеллект:</span>
                      <span className="font-medium">{character.stats.psychological.intelligence}/10</span>
                    </div>
                    <Progress value={character.stats.psychological.intelligence * 10} className="h-2" />
        </div>

                  <Separator />
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Основные фетиши:</span>
                      <span>{character.fetishes.primary.length}</span>
                </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Вторичные фетиши:</span>
                      <span>{character.fetishes.secondary.length}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Взаимодействий:</span>
                      <span>{character.totalInteractions}</span>
                  </div>
                </div>
                </CardContent>
              </Card>
                  ))}
              </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gameConfig?.characters?.templates && Object.entries(gameConfig.characters.templates).map(([key, template]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge className={getArchetypeColor(template.archetype)}>
                    {template.archetype}
                  </Badge>
                </CardContent>
              </Card>
                ))}
              </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Категории навыков</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gameConfig?.characters?.config?.skillCategories && Object.entries(gameConfig.characters.config.skillCategories).map(([key, category]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-md">{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {category.skills.map((skill: string) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                  ))}
                </div>
                  </CardContent>
                </Card>
                  ))}
                </div>
              </div>

              <div>
            <h3 className="text-lg font-semibold mb-3">Категории фетишей</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gameConfig?.characters?.config?.fetishCategories && Object.entries(gameConfig.characters.config.fetishCategories).map(([key, category]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-md">{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {category.fetishes.map((fetish: string) => (
                        <Badge key={fetish} variant="outline" className="text-xs">
                          {fetish}
                        </Badge>
                          ))}
                        </div>
                  </CardContent>
                </Card>
                  ))}
                </div>
              </div>
        </TabsContent>
      </Tabs>

      {/* Детальная информация о выбранном персонаже */}
      {selectedCharacter && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src="" />
                <AvatarFallback>{selectedCharacter.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div>{selectedCharacter.name}</div>
                <div className="text-sm font-normal text-gray-600">
                  {selectedCharacter.archetype} • {selectedCharacter.emotionalState}
                </div>
                </div>
            </CardTitle>
            <CardDescription>{selectedCharacter.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Физические характеристики</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Выносливость:</span>
                    <span>{selectedCharacter.stats.physical.endurance}/10</span>
              </div>
                  <div className="flex justify-between">
                    <span>Чувствительность:</span>
                    <span>{selectedCharacter.stats.physical.sensitivity}/10</span>
            </div>
                  <div className="flex justify-between">
                    <span>Гибкость:</span>
                    <span>{selectedCharacter.stats.physical.flexibility}/10</span>
          </div>
      </div>
            </div>
              
              <div>
                <h4 className="font-semibold mb-2">Психологические характеристики</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Эмоциональная стабильность:</span>
                    <span>{selectedCharacter.stats.psychological.emotionalStability}/10</span>
          </div>
                  <div className="flex justify-between">
                    <span>Адаптивность:</span>
                    <span>{selectedCharacter.stats.psychological.adaptability}/10</span>
              </div>
                  <div className="flex justify-between">
                    <span>Интеллект:</span>
                    <span>{selectedCharacter.stats.psychological.intelligence}/10</span>
          </div>
            </div>
          </div>
        </div>
            
            <Separator />
            
                    <div>
              <h4 className="font-semibold mb-2">Фетиши</h4>
              <div className="space-y-2">
                {selectedCharacter.fetishes.primary.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-red-600 mb-1">Основные:</div>
                      <div className="flex flex-wrap gap-1">
                      {selectedCharacter.fetishes.primary.map((fetish) => (
                        <Badge key={fetish.id} variant="destructive" className="text-xs">
                          {fetish.name} ({fetish.intensity}/10)
                        </Badge>
                        ))}
                      </div>
                      </div>
                    )}

                {selectedCharacter.fetishes.secondary.length > 0 && (
                      <div>
                    <div className="text-sm font-medium text-orange-600 mb-1">Вторичные:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedCharacter.fetishes.secondary.map((fetish) => (
                        <Badge key={fetish.id} variant="secondary" className="text-xs">
                          {fetish.name} ({fetish.intensity}/10)
                        </Badge>
                      ))}
          </div>
        </div>
      )}

                {selectedCharacter.fetishes.discovered.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-blue-600 mb-1">Обнаруженные:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedCharacter.fetishes.discovered.map((fetish) => (
                        <Badge key={fetish.id} variant="outline" className="text-xs">
                          {fetish.name} ({fetish.intensity}/10)
                        </Badge>
                      ))}
          </div>
        </div>
      )}
            </div>
          </div>

            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <div>Создан: {new Date(selectedCharacter.createdAt).toLocaleDateString()}</div>
                <div>Последнее взаимодействие: {new Date(selectedCharacter.lastInteraction).toLocaleDateString()}</div>
              </div>
                      <div>
                <div>Стиль коммуникации: {selectedCharacter.communicationStyle}</div>
                <div>Всего взаимодействий: {selectedCharacter.totalInteractions}</div>
                      </div>
                      </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
