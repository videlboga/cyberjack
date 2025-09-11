"use client"

import { useState, useEffect } from 'react'
import { DatabaseEntityList } from '@/app/game/components/ui/DatabaseEntityList'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function TestEntitiesPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🧪 Загружаем данные для тестирования...')
        const response = await fetch('/api/db/config')
        const result = await response.json()

        if (result.success) {
          setData(result.config)
          console.log('✅ Данные загружены:', {
            characters: result.config.characters?.length || 0,
            actions: Object.keys(result.config.actions?.categories || {}).length,
            contracts: result.config.contracts?.length || 0,
            equipment: result.config.equipment?.length || 0
          })
        } else {
          setError(result.error || 'Ошибка загрузки данных')
        }
      } catch (err) {
        console.error('❌ Ошибка:', err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Ошибка загрузки данных</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Данные не найдены</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Не удалось загрузить данные из API</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🧪 Тест отображения сущностей</h1>
        <div className="flex gap-4 flex-wrap">
          <Badge variant="outline">
            Персонажи: {data.characters?.length || 0}
          </Badge>
          <Badge variant="outline">
            Действия: {Object.keys(data.actions?.categories || {}).length}
          </Badge>
          <Badge variant="outline">
            Контракты: {data.contracts?.length || 0}
          </Badge>
          <Badge variant="outline">
            Оборудование: {data.equipment?.length || 0}
          </Badge>
        </div>
      </div>

      <div className="space-y-8">
        {/* Персонажи */}
        <Card>
          <CardHeader>
            <CardTitle>Персонажи из базы данных</CardTitle>
          </CardHeader>
          <CardContent>
            <DatabaseEntityList
              entities={data.characters || []}
              type="character"
              title=""
              onEdit={(entity) => console.log('Редактировать персонажа:', entity)}
              onView={(entity) => console.log('Просмотр персонажа:', entity)}
            />
          </CardContent>
        </Card>

        {/* Действия */}
        <Card>
          <CardHeader>
            <CardTitle>Действия из базы данных</CardTitle>
          </CardHeader>
          <CardContent>
            <DatabaseEntityList
              entities={Object.values(data.actions?.categories || {}).flat()}
              type="action"
              title=""
              onEdit={(entity) => console.log('Редактировать действие:', entity)}
              onView={(entity) => console.log('Просмотр действия:', entity)}
            />
          </CardContent>
        </Card>

        {/* Контракты */}
        <Card>
          <CardHeader>
            <CardTitle>Контракты из базы данных</CardTitle>
          </CardHeader>
          <CardContent>
            <DatabaseEntityList
              entities={data.contracts || []}
              type="contract"
              title=""
              onEdit={(entity) => console.log('Редактировать контракт:', entity)}
              onView={(entity) => console.log('Просмотр контракта:', entity)}
            />
          </CardContent>
        </Card>

        {/* Оборудование */}
        <Card>
          <CardHeader>
            <CardTitle>Оборудование из базы данных</CardTitle>
          </CardHeader>
          <CardContent>
            <DatabaseEntityList
              entities={data.equipment || []}
              type="equipment"
              title=""
              onEdit={(entity) => console.log('Редактировать оборудование:', entity)}
              onView={(entity) => console.log('Просмотр оборудования:', entity)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
