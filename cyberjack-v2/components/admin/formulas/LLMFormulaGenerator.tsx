"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NaturalLanguageFormula } from '@/lib/core/formulas/types/formula-node'

interface LLMFormulaGeneratorProps {
  onGenerate: (formula: NaturalLanguageFormula) => void
}

export function LLMFormulaGenerator({ onGenerate }: LLMFormulaGeneratorProps) {
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedFormula, setGeneratedFormula] = useState<NaturalLanguageFormula | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Введите описание формулы')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Создаем улучшенный промпт для LLM
      const prompt = `Ты - эксперт по созданию формул для игровой системы.

Доступные переменные:
- character.mood (настроение персонажа, 0-100)
- character.energy (энергия персонажа, 0-100)
- character.health (здоровье персонажа, 0-100)
- action.intensity (интенсивность действия, 0-100)
- action.duration (длительность действия в секундах)
- action.cost (стоимость действия)
- user.modifier (модификатор пользователя, обычно 0.5-2.0)
- user.credits (кредиты пользователя)
- zone.sensitivity (чувствительность зоны, 0-100)

Доступные функции:
- min(a, b) - минимальное значение
- max(a, b) - максимальное значение
- abs(x) - абсолютное значение
- if(условие, значение_если_да, значение_если_нет) - условная логика

Операторы: +, -, *, /, ==, !=, <, >, <=, >=

Задача: Преобразуй описание "${description}" в точную математическую формулу.

Требования:
1. Используй только доступные переменные и функции
2. Формула должна быть валидной и выполнимой
3. Учитывай логику игры (значения обычно в диапазоне 0-100)
4. Верни только формулу без объяснений

Примеры:
- "Умножь базовое значение 10 на интенсивность действия" → "10 * action.intensity"
- "Если настроение больше 50, эффект 20, иначе 10" → "if(character.mood > 50, 20, 10)"
- "Восстанови здоровье на 10% от недостающего" → "character.health + (100 - character.health) * 0.1"`

      // Вызов API для генерации формулы
      const response = await fetch('/api/formulas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: prompt,
          context: {
            // Примерный контекст для генерации
            character: {
              id: 'test-character',
              name: 'Test Character',
              characteristics: {
                mood: 50,
                energy: 75,
                health: 100
              }
            },
            user: {
              id: 'test-user',
              name: 'Test User',
              modifiers: {
                mood: 1.2,
                energy: 0.8
              },
              credits: 1000
            },
            action: {
              id: 'test-action',
              name: 'Test Action',
              intensity: 50,
              cost: 10,
              duration: 30
            },
            system: {
              gameTime: 120,
              realTime: Date.now(),
              isActionHolding: false,
              timeMultiplier: 1
            }
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка генерации формулы')
      }

      const naturalFormula = await response.json()
      setGeneratedFormula(naturalFormula)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка генерации формулы')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUseFormula = () => {
    if (generatedFormula) {
      onGenerate(generatedFormula)
    }
  }

  const handleClear = () => {
    setDescription('')
    setGeneratedFormula(null)
    setError(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">🤖 LLM Генератор формул</h3>
        <p className="text-blue-700 text-sm">
          Опишите формулу на естественном языке, и ИИ создаст структурированную формулу для игровой системы.
        </p>
      </div>

      {/* Ввод описания */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-semibold mb-4">Описание формулы</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Опишите логику формулы на естественном языке:
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: Умножь базовое значение 10 на интенсивность действия, затем примени модификатор пользователя для настроения"
              className="w-full h-32 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isGenerating}
            />
          </div>

          {/* Примеры */}
          <div>
            <h5 className="font-medium mb-2">Примеры описаний:</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                onClick={() => setDescription('Умножь базовое значение 10 на интенсивность действия')}
                className="text-left p-2 bg-gray-50 rounded text-sm hover:bg-gray-100"
                disabled={isGenerating}
              >
                Базовый эффект действия
              </button>
              <button
                onClick={() => setDescription('Если настроение больше 50, эффект 20, иначе 10')}
                className="text-left p-2 bg-gray-50 rounded text-sm hover:bg-gray-100"
                disabled={isGenerating}
              >
                Условный эффект
              </button>
              <button
                onClick={() => setDescription('Восстанови здоровье на 10% от недостающего')}
                className="text-left p-2 bg-gray-50 rounded text-sm hover:bg-gray-100"
                disabled={isGenerating}
              >
                Восстановление здоровья
              </button>
              <button
                onClick={() => setDescription('Умножь интенсивность действия на модификатор пользователя, но не больше 100')}
                className="text-left p-2 bg-gray-50 rounded text-sm hover:bg-gray-100"
                disabled={isGenerating}
              >
                Ограниченный эффект
              </button>
              <button
                onClick={() => setDescription('Если энергия меньше 20, эффект уменьшается в 2 раза')}
                className="text-left p-2 bg-gray-50 rounded text-sm hover:bg-gray-100"
                disabled={isGenerating}
              >
                Эффект усталости
              </button>
              <button
                onClick={() => setDescription('Базовый эффект 15 плюс случайное значение от 0 до 10')}
                className="text-left p-2 bg-gray-50 rounded text-sm hover:bg-gray-100"
                disabled={isGenerating}
              >
                Случайный эффект
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
            >
              {isGenerating ? 'Генерация...' : 'Сгенерировать формулу'}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Очистить
            </Button>
          </div>
        </div>
      </div>

      {/* Результат генерации */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Ошибка генерации</h4>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {generatedFormula && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-semibold">Сгенерированная формула</h4>
              <p className="text-sm text-gray-600">Уверенность: {Math.round(generatedFormula.confidence * 100)}%</p>
            </div>
            <Button onClick={handleUseFormula}>
              Использовать формулу
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Описание */}
            <div>
              <h5 className="font-medium mb-2">Описание:</h5>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {generatedFormula.description}
              </p>
            </div>

            {/* Естественное выражение */}
            <div>
              <h5 className="font-medium mb-2">Естественное выражение:</h5>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {generatedFormula.naturalExpression}
              </p>
            </div>

            {/* Предложения */}
            <div className="md:col-span-2">
              <h5 className="font-medium mb-2">Предложения:</h5>
              <ul className="text-sm text-gray-700 space-y-1">
                {generatedFormula.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Структурированная формула (упрощенный вид) */}
          <div className="mt-6">
            <h5 className="font-medium mb-2">Структурированная формула:</h5>
            <div className="bg-gray-100 p-4 rounded text-sm font-mono">
              <pre>{JSON.stringify(generatedFormula.structuredFormula, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Справка */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="font-semibold mb-4">Справка по созданию формул</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium mb-2">Доступные переменные:</h5>
            <ul className="text-sm space-y-1">
              <li><code className="bg-gray-200 px-1 rounded">character.characteristics.mood</code> - Настроение персонажа</li>
              <li><code className="bg-gray-200 px-1 rounded">action.intensity</code> - Интенсивность действия</li>
              <li><code className="bg-gray-200 px-1 rounded">user.modifiers.mood</code> - Модификатор пользователя</li>
              <li><code className="bg-gray-200 px-1 rounded">zone.sensitivity</code> - Чувствительность зоны</li>
            </ul>
          </div>

          <div>
            <h5 className="font-medium mb-2">Доступные функции:</h5>
            <ul className="text-sm space-y-1">
              <li><code className="bg-gray-200 px-1 rounded">MIN()</code> - Минимальное значение</li>
              <li><code className="bg-gray-200 px-1 rounded">MAX()</code> - Максимальное значение</li>
              <li><code className="bg-gray-200 px-1 rounded">ABS()</code> - Абсолютное значение</li>
              <li><code className="bg-gray-200 px-1 rounded">IF()</code> - Условная логика</li>
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <h5 className="font-medium mb-2">Советы:</h5>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Используйте понятные и описательные формулировки</li>
            <li>• Указывайте конкретные числовые значения где возможно</li>
            <li>• Объясняйте логику условий и ветвлений</li>
            <li>• Протестируйте формулу после создания</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
