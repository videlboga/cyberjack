"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface SimpleFormulaBuilderProps {
  initialFormula?: string
  onSave?: (formula: string) => void
  onCancel?: () => void
}

export function SimpleFormulaBuilder({ initialFormula, onSave, onCancel }: SimpleFormulaBuilderProps) {
  const [formula, setFormula] = useState(initialFormula || '')
  const [isValid, setIsValid] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')

  // Простые шаблоны формул
  const templates = [
    {
      name: 'Базовый эффект',
      formula: '10 * action.intensity / 100',
      description: 'Умножает 10 на интенсивность действия'
    },
    {
      name: 'Условный эффект',
      formula: 'if(character.mood > 50, 20, 10)',
      description: 'Если настроение > 50, то 20, иначе 10'
    },
    {
      name: 'С модификатором',
      formula: '10 * action.intensity / 100 * user.modifiers.mood',
      description: 'Базовый эффект с модификатором пользователя'
    },
    {
      name: 'Восстановление',
      formula: 'character.health + (100 - character.health) * 0.1',
      description: 'Восстанавливает 10% недостающего здоровья'
    },
    {
      name: 'Ограниченный',
      formula: 'min(100, character.energy + 10 * action.intensity / 100)',
      description: 'Восстанавливает энергию, но не больше 100'
    }
  ]

  // Быстрые вставки
  const quickInserts = [
    { label: 'Настроение', value: 'character.mood' },
    { label: 'Энергия', value: 'character.energy' },
    { label: 'Здоровье', value: 'character.health' },
    { label: 'Интенсивность', value: 'action.intensity' },
    { label: 'Модификатор', value: 'user.modifiers.mood' },
    { label: 'Чувствительность', value: 'zone.sensitivity' },
    { label: 'MIN', value: 'min(' },
    { label: 'MAX', value: 'max(' },
    { label: 'IF', value: 'if(' },
    { label: '+', value: ' + ' },
    { label: '-', value: ' - ' },
    { label: '*', value: ' * ' },
    { label: '/', value: ' / ' },
    { label: '>', value: ' > ' },
    { label: '<', value: ' < ' },
    { label: '(', value: '(' },
    { label: ')', value: ')' }
  ]

  // Валидация формулы
  useEffect(() => {
    if (!formula.trim()) {
      setIsValid(true)
      setError('')
      setPreview('')
      return
    }

    // Простая валидация
    const errors = []
    
    // Проверка скобок
    const openParens = (formula.match(/\(/g) || []).length
    const closeParens = (formula.match(/\)/g) || []).length
    if (openParens !== closeParens) {
      errors.push('Несоответствие скобок')
    }

    // Проверка двойных операторов
    if (formula.match(/[+\-*/]{2,}/)) {
      errors.push('Двойные операторы')
    }

    // Проверка пустых скобок
    if (formula.match(/\(\s*\)/)) {
      errors.push('Пустые скобки')
    }

    if (errors.length > 0) {
      setIsValid(false)
      setError(errors.join(', '))
    } else {
      setIsValid(true)
      setError('')
    }

    // Предварительный просмотр
    setPreview(formula)
  }, [formula])

  const insertAtCursor = (text: string) => {
    const textarea = document.getElementById('formula-input') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newFormula = formula.substring(0, start) + text + formula.substring(end)
    
    setFormula(newFormula)

    // Устанавливаем курсор после вставленного текста
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const handleSave = () => {
    if (formula.trim() && isValid && onSave) {
      onSave(formula.trim())
    }
  }

  const handleTemplateSelect = (templateFormula: string) => {
    setFormula(templateFormula)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Заголовок */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Конструктор формул</h2>
            <p className="text-gray-600">Простое создание формул для действий</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formula.trim() || !isValid}
            >
              Сохранить
            </Button>
          </div>
        </div>

        {/* Основной контент */}
        <div className="flex-1 flex overflow-hidden">
          {/* Левая панель - редактор */}
          <div className="flex-1 p-6">
            <div className="space-y-4">
              {/* Редактор формулы */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Формула:
                </label>
                <textarea
                  id="formula-input"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="Введите формулу, например: 10 * action.intensity / 100"
                  className="w-full h-32 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  style={{ resize: 'vertical' }}
                />
                {error && (
                  <p className="text-red-600 text-sm mt-1">Ошибка: {error}</p>
                )}
                {isValid && formula && (
                  <p className="text-green-600 text-sm mt-1">✓ Формула корректна</p>
                )}
              </div>

              {/* Быстрые вставки */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Быстрые вставки:
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickInserts.map((insert, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => insertAtCursor(insert.value)}
                      className="text-xs"
                    >
                      {insert.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Предварительный просмотр */}
              {preview && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Предварительный просмотр:
                  </label>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                    {preview}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Правая панель - шаблоны и справка */}
          <div className="w-80 border-l bg-gray-50 p-6">
            <div className="space-y-6">
              {/* Шаблоны */}
              <div>
                <h3 className="font-semibold mb-3">Готовые шаблоны</h3>
                <div className="space-y-2">
                  {templates.map((template, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white border rounded cursor-pointer hover:border-blue-300 transition-colors"
                      onClick={() => handleTemplateSelect(template.formula)}
                    >
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                      <div className="text-xs font-mono bg-gray-100 p-1 rounded mt-2">
                        {template.formula}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Справка */}
              <div>
                <h3 className="font-semibold mb-3">Справка</h3>
                <div className="text-sm space-y-3">
                  <div>
                    <h4 className="font-medium">Переменные:</h4>
                    <ul className="text-xs space-y-1 mt-1">
                      <li><code className="bg-gray-200 px-1 rounded">character.mood</code> - Настроение</li>
                      <li><code className="bg-gray-200 px-1 rounded">character.energy</code> - Энергия</li>
                      <li><code className="bg-gray-200 px-1 rounded">action.intensity</code> - Интенсивность</li>
                      <li><code className="bg-gray-200 px-1 rounded">user.modifiers.mood</code> - Модификатор</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium">Функции:</h4>
                    <ul className="text-xs space-y-1 mt-1">
                      <li><code className="bg-gray-200 px-1 rounded">min(a, b)</code> - Минимум</li>
                      <li><code className="bg-gray-200 px-1 rounded">max(a, b)</code> - Максимум</li>
                      <li><code className="bg-gray-200 px-1 rounded">if(условие, да, нет)</code> - Условие</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Операторы:</h4>
                    <div className="text-xs">
                      <code className="bg-gray-200 px-1 rounded">+ - * / &gt; &lt; &gt;= &lt;= == !=</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
