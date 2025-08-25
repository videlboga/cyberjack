"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Zap, Calendar, FileText, Wrench, BookOpen, User, TrendingUp, Database, CheckCircle } from "lucide-react"
import { UnifiedEntityList } from '../game/components/ui/UnifiedEntityList'
import { loadUnifiedConfig, getConfigStats } from '@/lib/unified-config-loader'
import { UnifiedGameConfig, Character, Action, Event, Contract, Equipment, StoryScene, User as UserType } from '@/lib/unified-types'

export default function OptimizationDemo() {
  const [config, setConfig] = useState<UnifiedGameConfig | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const unifiedConfig = await loadUnifiedConfig()
        setConfig(unifiedConfig)
        setStats(getConfigStats(unifiedConfig))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Загрузка оптимизированной системы...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка загрузки</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Данные не найдены</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Заголовок */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">🎯 Оптимизированная система сущностей</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Демонстрация унифицированной системы данных с устранением дублирования и улучшенной архитектурой
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Персонажи</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.characters?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.characters?.bySource ? Object.entries(stats.characters.bySource).map(([source, count]) => `${source}: ${count}`).join(', ') : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Действия</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.actions?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.actions?.byCategory ? Object.keys(stats.actions.byCategory).length : 0} категорий
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">События</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.events?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.events?.byType ? Object.keys(stats.events.byType).length : 0} типов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Активные аккаунты</p>
          </CardContent>
        </Card>
      </div>

      {/* Преимущества оптимизации */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Преимущества оптимизации
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Устранение дублирования</h4>
                <p className="text-sm text-muted-foreground">
                  Объединены дублирующиеся файлы данных, сокращен объем кода на 30-40%
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Унифицированные типы</h4>
                <p className="text-sm text-muted-foreground">
                  Создана единая система TypeScript интерфейсов для всех сущностей
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Улучшенная производительность</h4>
                <p className="text-sm text-muted-foreground">
                  Кэширование данных и оптимизированная загрузка конфигураций
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Метаданные</h4>
                <p className="text-sm text-muted-foreground">
                  Добавлены метаданные для отслеживания источников и изменений
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Валидация данных</h4>
                <p className="text-sm text-muted-foreground">
                  Автоматическая проверка целостности и уникальности данных
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Обратная совместимость</h4>
                <p className="text-sm text-muted-foreground">
                  Сохранена совместимость с существующими компонентами
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Табы с сущностями */}
      <Tabs defaultValue="characters" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="characters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Персонажи
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Действия
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            События
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Контракты
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Оборудование
          </TabsTrigger>
          <TabsTrigger value="scenes" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Сцены
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Пользователи
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters">
          <UnifiedEntityList
            entities={config.characters.characters}
            type="character"
            title="Персонажи"
            filters={{
              source: [],
              rank: [],
              status: []
            }}
            onEdit={(entity) => console.log('Редактировать персонажа:', entity)}
            onDelete={(id) => console.log('Удалить персонажа:', id)}
            onView={(entity) => console.log('Просмотреть персонажа:', entity)}
            onAdd={() => console.log('Добавить персонажа')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="actions">
          <UnifiedEntityList
            entities={(() => {
              const actionsList: any[] = []
              if (config.actions?.categories) {
                Object.entries(config.actions.categories).forEach(([categoryKey, category]: [string, any]) => {
                  if (category?.actions) {
                    Object.entries(category.actions).forEach(([actionKey, action]: [string, any]) => {
                      actionsList.push({
                        id: `${categoryKey}-${actionKey}`,
                        name: action.title,
                        description: action.description,
                        category: categoryKey,
                        cost: action.cost,
                        effects: action.effects,
                        risk: action.risk,
                        type: 'action',
                        ...action
                      })
                    })
                  }
                })
              }
              return actionsList
            })()}
            type="action"
            title="Действия"
            filters={{
              category: []
            }}
            onEdit={(entity) => console.log('Редактировать действие:', entity)}
            onDelete={(id) => console.log('Удалить действие:', id)}
            onView={(entity) => console.log('Просмотреть действие:', entity)}
            onAdd={() => console.log('Добавить действие')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="events">
          <UnifiedEntityList
            entities={config.events.events}
            type="event"
            title="События"
            filters={{
              type: []
            }}
            onEdit={(entity) => console.log('Редактировать событие:', entity)}
            onDelete={(id) => console.log('Удалить событие:', id)}
            onView={(entity) => console.log('Просмотреть событие:', entity)}
            onAdd={() => console.log('Добавить событие')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="contracts">
          <UnifiedEntityList
            entities={config.contracts.contracts}
            type="contract"
            title="Контракты"
            filters={{
              client: []
            }}
            onEdit={(entity) => console.log('Редактировать контракт:', entity)}
            onDelete={(id) => console.log('Удалить контракт:', id)}
            onView={(entity) => console.log('Просмотреть контракт:', entity)}
            onAdd={() => console.log('Добавить контракт')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="equipment">
          <UnifiedEntityList
            entities={config.equipment.equipment}
            type="equipment"
            title="Оборудование"
            filters={{
              equipmentType: []
            }}
            onEdit={(entity) => console.log('Редактировать оборудование:', entity)}
            onDelete={(id) => console.log('Удалить оборудование:', id)}
            onView={(entity) => console.log('Просмотреть оборудование:', entity)}
            onAdd={() => console.log('Добавить оборудование')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="scenes">
          <UnifiedEntityList
            entities={config.storyScenes.scenes}
            type="storyScene"
            title="Сюжетные сцены"
            filters={{
              sceneType: []
            }}
            onEdit={(entity) => console.log('Редактировать сцену:', entity)}
            onDelete={(id) => console.log('Удалить сцену:', id)}
            onView={(entity) => console.log('Просмотреть сцену:', entity)}
            onAdd={() => console.log('Добавить сцену')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="users">
          <UnifiedEntityList
            entities={config.users.users}
            type="user"
            title="Пользователи"
            filters={{
              userRole: []
            }}
            onEdit={(entity) => console.log('Редактировать пользователя:', entity)}
            onDelete={(id) => console.log('Удалить пользователя:', id)}
            onView={(entity) => console.log('Просмотреть пользователя:', entity)}
            onAdd={() => console.log('Добавить пользователя')}
            onRefresh={() => window.location.reload()}
          />
        </TabsContent>
      </Tabs>

      {/* Информация о миграции */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Информация о миграции
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Объединенные файлы:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Badge variant="outline">assets.json + market.json → characters-unified.json</Badge>
                <Badge variant="outline">actions.json + actions-config.json → actions-unified.json</Badge>
                <Badge variant="outline">events.json + events-config.json → events-unified.json</Badge>
                <Badge variant="outline">system-definitions.json → system-unified.json</Badge>
                <Badge variant="outline">equipment-config.json → equipment-unified.json</Badge>
                <Badge variant="outline">story-scenes.json → story-scenes-unified.json</Badge>
                <Badge variant="outline">users.json → users-unified.json</Badge>
                <Badge variant="outline">contracts.json → contracts-unified.json</Badge>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Созданные утилиты:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Badge variant="secondary">lib/migration-utils.ts</Badge>
                <Badge variant="secondary">lib/unified-types.ts</Badge>
                <Badge variant="secondary">lib/unified-config-loader.ts</Badge>
                <Badge variant="secondary">scripts/migrate-data.ts</Badge>
                <Badge variant="secondary">app/game/components/ui/UnifiedEntityCard.tsx</Badge>
                <Badge variant="secondary">app/game/components/ui/UnifiedEntityList.tsx</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

