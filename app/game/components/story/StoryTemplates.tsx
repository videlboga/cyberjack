'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Package,
  Target,
  AlertTriangle,
  Building,
  Zap,
  Users,
  Gamepad2,
  Star,
  Plus,
  Save,
  Copy,
  Trash2,
  Search
} from "lucide-react"

import { StoryTemplate, StoryScene, StoryScreen, StoryChoice, StoryTrigger } from '@/lib/unified-entities'

// Готовые шаблоны для разных типов событий
const defaultTemplates: StoryTemplate[] = [
  {
    id: 'market-auction',
    name: 'Корпоративный аукцион',
    description: 'Стандартный аукцион талантов с корпоративными участниками',
    type: 'auction',
    template: {
      id: 'corporate_auction',
      title: 'Корпоративный аукцион',
      description: 'Представители крупных корпораций посещают станцию для аукциона активов',
      type: 'auction',
      category: 'market',
      tags: ['corporate', 'auction', 'talents'],
      triggerConditions: [
        {
          id: 'reputation_check',
          type: 'story_point',
          condition: {
            type: 'comparison',
            field: 'market_reputation',
            operator: '>=',
            value: 50
          },
          probability: 80
        }
      ],
      probability: 60,
      screens: [
        {
          id: 'auction_intro',
          title: 'Вход в аукционный зал',
          description: 'Вы входите в роскошный аукционный зал, где представители корпораций уже заняли свои места',
          background: '/auction-hall.png',
          choices: [
            {
              id: 'observe',
              text: 'Наблюдать за участниками',
              consequences: [
                { type: 'story_point_change', pointId: 'corporate_connections', change: 1 }
              ],
              navigation: { type: 'goto_screen', screenId: 'auction_start' }
            },
            {
              id: 'network',
              text: 'Попытаться завести связи',
              consequences: [
                { type: 'story_point_change', pointId: 'corporate_connections', change: 2 },
                { type: 'story_point_change', pointId: 'negotiation_skill', change: 1 }
              ],
              navigation: { type: 'goto_screen', screenId: 'networking' }
            }
          ]
        },
        {
          id: 'auction_start',
          title: 'Начало аукциона',
          description: 'Аукцион начинается. Первый лот - высококвалифицированный талант',
          background: '/auction-stage.png',
          choices: [
            {
              id: 'bid_aggressive',
              text: 'Агрессивная ставка',
              consequences: [
                { type: 'lose_credits', amount: 500 },
                { type: 'gain_talent', talentData: { name: 'Элитный талант', rank: 'A' } }
              ],
              navigation: { type: 'end_scene' }
            },
            {
              id: 'bid_conservative',
              text: 'Консервативная ставка',
              consequences: [
                { type: 'lose_credits', amount: 200 },
                { type: 'gain_talent', talentData: { name: 'Средний талант', rank: 'B' } }
              ],
              navigation: { type: 'end_scene' }
            }
          ]
        }
      ]
    },
    tags: ['corporate', 'auction', 'market']
  },
  {
    id: 'void-anomaly',
    name: 'Аномалия в Void',
    description: 'Странные события в зоне Void Border',
    type: 'anomaly',
    template: {
      id: 'void_anomaly',
      title: 'Временная аномалия в Тени',
      description: 'Странные искажения времени в Void Border',
      type: 'anomaly',
      category: 'void',
      tags: ['void', 'anomaly', 'time'],
      triggerConditions: [
        {
          id: 'void_experience_check',
          type: 'story_point',
          condition: {
            type: 'comparison',
            field: 'void_experience',
            operator: '>=',
            value: 1
          },
          probability: 30
        }
      ],
      probability: 20,
      screens: [
        {
          id: 'anomaly_detection',
          title: 'Обнаружение аномалии',
          description: 'Сканеры обнаруживают странные искажения в пространстве-времени',
          background: '/void-anomaly.png',
          choices: [
            {
              id: 'investigate',
              text: 'Исследовать аномалию',
              consequences: [
                { type: 'story_point_change', pointId: 'void_experience', change: 2 },
                { type: 'gain_equipment', equipmentId: 'temporal_scanner' }
              ],
              navigation: { type: 'goto_screen', screenId: 'anomaly_core' }
            },
            {
              id: 'avoid',
              text: 'Избежать аномалии',
              consequences: [
                { type: 'gain_credits', amount: 100 }
              ],
              navigation: { type: 'end_scene' }
            }
          ]
        },
        {
          id: 'anomaly_core',
          title: 'Ядро аномалии',
          description: 'Вы находитесь в эпицентре временного искажения',
          background: '/anomaly-core.png',
          choices: [
            {
              id: 'harness_power',
              text: 'Попытаться использовать силу аномалии',
              consequences: [
                { type: 'talent_stat_change', talentId: 'current', stat: 'intelligence', change: 3 },
                { type: 'talent_stat_change', talentId: 'current', stat: 'anxiety', change: 5 }
              ],
              navigation: { type: 'end_scene' }
            },
            {
              id: 'stabilize',
              text: 'Стабилизировать аномалию',
              consequences: [
                { type: 'gain_credits', amount: 300 },
                { type: 'story_point_change', pointId: 'void_experience', change: 3 }
              ],
              navigation: { type: 'end_scene' }
            }
          ]
        }
      ]
    },
    tags: ['void', 'anomaly', 'time']
  },
  {
    id: 'corporate-contract',
    name: 'Корпоративный контракт',
    description: 'Стандартный корпоративный контракт с условиями',
    type: 'contract',
    template: {
      id: 'corporate_contract',
      title: 'Предложение корпоративного контракта',
      description: 'Корпорация предлагает долгосрочный контракт на поставку талантов',
      type: 'contract',
      category: 'corporate',
      tags: ['corporate', 'contract', 'long-term'],
      triggerConditions: [
        {
          id: 'corporate_standing_check',
          type: 'story_point',
          condition: {
            type: 'comparison',
            field: 'corporate_connections',
            operator: '>=',
            value: 5
          },
          probability: 70
        }
      ],
      probability: 40,
      screens: [
        {
          id: 'contract_meeting',
          title: 'Встреча с корпорацией',
          description: 'Представитель корпорации представляет условия контракта',
          background: '/corporate-office.png',
          choices: [
            {
              id: 'negotiate',
              text: 'Вести переговоры',
              consequences: [
                { type: 'story_point_change', pointId: 'negotiation_skill', change: 2 }
              ],
              navigation: { type: 'goto_screen', screenId: 'contract_terms' }
            },
            {
              id: 'accept_immediate',
              text: 'Принять условия',
              consequences: [
                { type: 'gain_credits', amount: 1000 },
                { type: 'story_point_change', pointId: 'corporate_connections', change: 3 }
              ],
              navigation: { type: 'end_scene' }
            }
          ]
        },
        {
          id: 'contract_terms',
          title: 'Условия контракта',
          description: 'Детали контракта и обязательства',
          background: '/contract-details.png',
          choices: [
            {
              id: 'sign_contract',
              text: 'Подписать контракт',
              consequences: [
                { type: 'gain_credits', amount: 1500 },
                { type: 'story_point_change', pointId: 'corporate_connections', change: 5 }
              ],
              navigation: { type: 'end_scene' }
            },
            {
              id: 'reject_contract',
              text: 'Отклонить контракт',
              consequences: [
                { type: 'story_point_change', pointId: 'corporate_connections', change: -2 }
              ],
              navigation: { type: 'end_scene' }
            }
          ]
        }
      ]
    },
    tags: ['corporate', 'contract', 'long-term']
  },
  {
    id: 'void-rescue',
    name: 'Спасательная операция в Void',
    description: 'Опасная миссия по спасению талантов из зоны Void',
    type: 'void_rescue',
    template: {
      id: 'void_rescue_mission',
      title: 'Сигнал бедствия из Void',
      description: 'Обнаружен сигнал бедствия из опасной зоны Void Border',
      type: 'void_rescue',
      category: 'void',
      tags: ['void', 'rescue', 'dangerous'],
      triggerConditions: [
        {
          id: 'void_experience_check',
          type: 'story_point',
          condition: {
            type: 'comparison',
            field: 'void_experience',
            operator: '>=',
            value: 0
          },
          probability: 60
        }
      ],
      probability: 50,
      screens: [
        {
          id: 'rescue_approach',
          title: 'Приближение к зоне спасения',
          description: 'Ваш корабль медленно приближается к опасной зоне',
          background: '/void-approach.png',
          choices: [
            {
              id: 'scan_area',
              text: 'Просканировать область',
              consequences: [
                { type: 'gain_equipment', equipmentId: 'scanner_data' },
                { type: 'story_point_change', pointId: 'void_experience', change: 1 }
              ],
              navigation: { type: 'goto_screen', screenId: 'rescue_operation' }
            },
            {
              id: 'rush_in',
              text: 'Немедленно начать спасательную операцию',
              consequences: [
                { type: 'gain_credits', amount: 100 },
                { type: 'talent_stat_change', talentId: 'current', stat: 'anxiety', change: 5 }
              ],
              navigation: { type: 'goto_screen', screenId: 'dangerous_rescue' }
            }
          ]
        },
        {
          id: 'rescue_operation',
          title: 'Спасательная операция',
          description: 'Вы находите поврежденный корабль с талантами на борту',
          background: '/rescue-operation.png',
          choices: [
            {
              id: 'rescue_all',
              text: 'Спасти всех талантов',
              consequences: [
                { type: 'gain_talent', talentData: { name: 'Спасенный талант', rank: 'B' } },
                { type: 'gain_credits', amount: 300 },
                { type: 'story_point_change', pointId: 'void_experience', change: 2 }
              ],
              navigation: { type: 'end_scene' }
            },
            {
              id: 'selective_rescue',
              text: 'Выборочное спасение',
              consequences: [
                { type: 'gain_talent', talentData: { name: 'Элитный талант', rank: 'A' } },
                { type: 'story_point_change', pointId: 'void_experience', change: 1 }
              ],
              navigation: { type: 'end_scene' }
            }
          ]
        }
      ]
    },
    tags: ['void', 'rescue', 'dangerous']
  }
]

interface StoryTemplatesProps {
  onTemplateSelect: (template: StoryTemplate) => void
  onTemplateSave?: (template: StoryTemplate) => void
  onTemplateDelete?: (templateId: string) => void
}

export const StoryTemplates: React.FC<StoryTemplatesProps> = ({
  onTemplateSelect,
  onTemplateSave,
  onTemplateDelete
}) => {
  const [templates, setTemplates] = useState<StoryTemplate[]>(defaultTemplates)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse')

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'market': return <Package className="h-4 w-4" />
      case 'auction': return <Target className="h-4 w-4" />
      case 'anomaly': return <AlertTriangle className="h-4 w-4" />
      case 'contract': return <Building className="h-4 w-4" />
      case 'void_rescue': return <Zap className="h-4 w-4" />
      case 'corporate': return <Users className="h-4 w-4" />
      case 'training': return <Gamepad2 className="h-4 w-4" />
      case 'therapy': return <Star className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'market': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'auction': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'anomaly': return 'bg-red-100 text-red-800 border-red-200'
      case 'contract': return 'bg-green-100 text-green-800 border-green-200'
      case 'void_rescue': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'corporate': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'training': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'therapy': return 'bg-pink-100 text-pink-800 border-pink-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedType === 'all' || template.type === selectedType
    return matchesSearch && matchesType
  })

  const handleTemplateSelect = (template: StoryTemplate) => {
    onTemplateSelect(template)
  }

  const handleTemplateCopy = (template: StoryTemplate) => {
    const copiedTemplate: StoryTemplate = {
      ...template,
      id: `${template.id}_copy_${Date.now()}`,
      name: `${template.name} (копия)`
    }
    setTemplates(prev => [...prev, copiedTemplate])
  }

  const handleTemplateDelete = (templateId: string) => {
    if (onTemplateDelete) {
      onTemplateDelete(templateId)
    } else {
      setTemplates(prev => prev.filter(t => t.id !== templateId))
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Шаблоны сюжетов</h2>
          <Button onClick={() => setActiveTab('create')} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Создать шаблон
          </Button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск шаблонов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="market">Рынок</SelectItem>
              <SelectItem value="auction">Аукцион</SelectItem>
              <SelectItem value="anomaly">Аномалии</SelectItem>
              <SelectItem value="contract">Контракты</SelectItem>
              <SelectItem value="void_rescue">Спасение в Void</SelectItem>
              <SelectItem value="corporate">Корпоративные</SelectItem>
              <SelectItem value="training">Тренировки</SelectItem>
              <SelectItem value="therapy">Терапия</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Просмотр</TabsTrigger>
          <TabsTrigger value="create">Создание</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="flex-1 p-4">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(template.type)}
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      <Badge className={getTypeColor(template.type)}>
                        {template.type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {template.template.screens?.length || 0} экранов
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Использовать
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTemplateCopy(template)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {onTemplateDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTemplateDelete(template.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="create" className="flex-1 p-4">
          <Card>
            <CardHeader>
              <CardTitle>Создать новый шаблон</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Название шаблона</Label>
                  <Input placeholder="Введите название шаблона" />
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea placeholder="Описание шаблона" rows={3} />
                </div>
                <div>
                  <Label>Тип события</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">Рынок</SelectItem>
                      <SelectItem value="auction">Аукцион</SelectItem>
                      <SelectItem value="anomaly">Аномалии</SelectItem>
                      <SelectItem value="contract">Контракты</SelectItem>
                      <SelectItem value="void_rescue">Спасение в Void</SelectItem>
                      <SelectItem value="corporate">Корпоративные</SelectItem>
                      <SelectItem value="training">Тренировки</SelectItem>
                      <SelectItem value="therapy">Терапия</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Теги</Label>
                  <Input placeholder="Введите теги через запятую" />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setActiveTab('browse')}>
                    Отмена
                  </Button>
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Создать шаблон
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
