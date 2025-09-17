"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SimpleFormulaBuilder } from './formulas/SimpleFormulaBuilder'
import { FilterPanel, FilterConfig, FilterState, useFilters } from './FilterPanel-v2'

interface Action {
  id: string
  name: string
  category: string
  description: string | null
  intensity: number
  formula: any
  requirements: Record<string, any>
  isActive: boolean
}

export function ActionsAdmin() {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showFormulaBuilder, setShowFormulaBuilder] = useState(false)
  const [currentFormula, setCurrentFormula] = useState<string>('')

  // Конфигурация фильтров
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    search: {
      placeholder: 'Поиск по названию или описанию...',
      fields: ['name', 'description']
    },
    selects: {
      category: {
        label: 'Категория',
        options: []
      },
      isActive: {
        label: 'Статус',
        options: [
          { value: 'true', label: 'Активные' },
          { value: 'false', label: 'Неактивные' }
        ]
      }
    },
    ranges: {
      intensity: {
        label: 'Интенсивность',
        min: 0,
        max: 100
      }
    },
    sort: {
      options: [
        { value: 'name:asc', label: 'Название (А-Я)' },
        { value: 'name:desc', label: 'Название (Я-А)' },
        { value: 'category:asc', label: 'Категория (А-Я)' },
        { value: 'category:desc', label: 'Категория (Я-А)' },
        { value: 'intensity:asc', label: 'Интенсивность (по возрастанию)' },
        { value: 'intensity:desc', label: 'Интенсивность (по убыванию)' }
      ],
      defaultSort: 'name:asc'
    }
  })

  // Состояние фильтров
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    selects: {},
    ranges: {},
    sort: 'name:asc'
  })

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    intensity: 5,
    formula: {},
    requirements: {},
    isActive: true
  })

  useEffect(() => {
    fetchActions()
  }, [])

  // Обновляем опции категорий при загрузке действий
  useEffect(() => {
    if (actions.length > 0) {
      const categories = [...new Set(actions.map(a => a.category))]
        .sort()
        .map(category => ({ value: category, label: category }))

      setFilterConfig(prev => ({
        ...prev,
        selects: {
          ...prev.selects,
          category: {
            ...(prev.selects?.category || {}),
            options: categories
          }
        }
      }))
    }
  }, [actions])

  const fetchActions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/actions')
      if (!response.ok) {
        throw new Error('Ошибка загрузки действий')
      }
      const data = await response.json()
      setActions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId ? `/api/actions/${editingId}` : '/api/actions'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения действия')
      }

      await fetchActions()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleEdit = (action: Action) => {
    setFormData({
      name: action.name,
      category: action.category,
      description: action.description || '',
      intensity: action.intensity,
      formula: action.formula,
      requirements: action.requirements,
      isActive: action.isActive
    })
    setEditingId(action.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить это действие?')) {
      return
    }

    try {
      const response = await fetch(`/api/actions/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Ошибка удаления действия')
      }
      await fetchActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      intensity: 5,
      formula: {},
      requirements: {},
      isActive: true
    })
    setEditingId(null)
    setShowForm(false)
    setCurrentFormula('')
  }

  const handleFormulaSave = (formula: string) => {
    setCurrentFormula(formula)
    setShowFormulaBuilder(false)

    // Добавляем формулу в formData
    setFormData(prev => ({
      ...prev,
      formula: formula
    }))
  }

  const handleFormulaCancel = () => {
    setShowFormulaBuilder(false)
  }

  const updateRequirements = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [key]: value
      }
    }))
  }

  // Функция для получения значения поля объекта
  const getItemValue = (item: Action, field: string) => {
    switch (field) {
      case 'name':
      case 'category':
      case 'description':
        return item[field] || ''
      case 'intensity':
        return item[field]
      case 'isActive':
        return item[field].toString()
      default:
        return ''
    }
  }

  // Применяем фильтры
  const filteredActions = useFilters(
    actions,
    filterState,
    filterConfig,
    getItemValue
  )

  // Сброс фильтров
  const resetFilters = () => {
    setFilterState({
      search: '',
      selects: {},
      ranges: {},
      sort: 'name:asc'
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Управление действиями</h2>
          <p className="text-sm text-gray-500 mt-1">
            Всего: {actions.length} |
            Показано: {filteredActions.length}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          Создать действие
        </Button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-yellow-800 mb-2">🎮 Новая система действий</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <p><strong>Принцип работы:</strong></p>
          <p>• Выбираем действие и кликаем/холдим на активной зоне персонажа</p>
          <p>• 1 клик = 1 секунда, холд = количество секунд</p>
          <p>• Формула вычисляет эффекты с учетом времени холда и контекста</p>
          <p>• Характеристики персонажа изменяются по результату формулы</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Панель фильтров */}
      <FilterPanel
        config={filterConfig}
        state={filterState}
        onStateChange={setFilterState}
        onReset={resetFilters}
        className="mb-6"
      />

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">
            {editingId ? 'Редактировать действие' : 'Создать действие'}
          </h3>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              <strong>💡 Подсказка:</strong> Действие будет применяться через клик/холд на активной зоне персонажа.
              Формула определит, как изменятся характеристики в зависимости от времени холда.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите название действия"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Категория</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите категорию"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите описание действия"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Интенсивность (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.intensity}
                onChange={(e) => setFormData({ ...formData, intensity: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Интенсивность влияет на силу эффектов действия
              </p>
            </div>

            {/* Информация о системе холда */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">🎮 Система холда</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Клик</strong> = 1 секунда выполнения</p>
                <p>• <strong>Холд</strong> = количество секунд удержания</p>
                <p>• <strong>Эффекты</strong> умножаются на время холда</p>
                <p>• <strong>Формула</strong> вычисляется с учетом времени и контекста</p>
              </div>
            </div>

            {/* Секция формул */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">Формулы эффектов</h4>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFormulaBuilder(true)}
                >
                  🧮 Конструктор формул
                </Button>
              </div>

              {currentFormula ? (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-green-800">Формула</h5>
                      <p className="text-sm text-green-700 font-mono">{currentFormula}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentFormula('')}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                  <p className="text-gray-600 text-sm mb-2">Формула не настроена</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>Примеры формул:</strong></p>
                    <p>• <code>0.2 * action.intensity</code> - базовое изменение от интенсивности</p>
                    <p>• <code>character.characteristics.mood * 0.1</code> - модификатор от настроения</p>
                    <p>• <code>zone.sensitivity * 0.05</code> - эффект от чувствительности зоны</p>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    Используйте конструктор формул для настройки эффектов
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                Активно
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? 'Обновить' : 'Создать'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {filteredActions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>
              {actions.length === 0
                ? 'Действия не найдены'
                : 'Нет действий, соответствующих фильтрам'
              }
            </p>
            <p className="text-sm mt-2">
              {actions.length === 0
                ? 'Создайте первое действие'
                : 'Попробуйте изменить параметры фильтрации'
              }
            </p>
          </div>
        ) : (
          filteredActions.map((action) => (
            <div key={action.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{action.name}</h3>
                    <span className="text-sm text-gray-500">({action.category})</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        action.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {action.isActive ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                  {action.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {action.description}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span>Интенсивность: {action.intensity}/100</span>
                    <span>Формула: {action.formula && Object.keys(action.formula).length > 0 ? 'Настроена' : 'Не настроена'}</span>
                    <span className="text-blue-600">🎮 Холд-система</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Применяется через клик/холд на активной зоне персонажа
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(action)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(action.id)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Модальное окно конструктора формул */}
      {showFormulaBuilder && (
        <SimpleFormulaBuilder
          initialFormula={currentFormula}
          onSave={handleFormulaSave}
          onCancel={handleFormulaCancel}
        />
      )}
    </div>
  )
}
