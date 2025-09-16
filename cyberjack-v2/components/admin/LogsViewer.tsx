// components/admin/LogsViewer.tsx

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { LogCategory, LogLevel } from '@/lib/utils/client-logger'

interface LogEntry {
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  data?: any
  userId?: string
  characterId?: string
  sessionId?: string
  requestId?: string
}

interface LogsResponse {
  success: boolean
  data: {
    logs: LogEntry[]
    total: number
    hasMore: boolean
  }
}

const LogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    category: '' as LogCategory | '',
    level: '' as LogLevel | '',
    limit: 100,
    offset: 0
  })
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.level) params.append('level', filters.level)
      params.append('limit', filters.limit.toString())
      params.append('offset', filters.offset.toString())

      const response = await fetch(`/api/admin/logs?${params}`)
      const data: LogsResponse = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setTotal(data.data.total)
        setHasMore(data.data.hasMore)
      } else {
        setError('Ошибка получения логов')
      }
    } catch (err) {
      setError('Ошибка загрузки логов')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000) // Обновляем каждые 5 секунд
      return () => clearInterval(interval)
    }
  }, [autoRefresh, fetchLogs])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Сбрасываем offset при изменении фильтров
    }))
  }

  const loadMore = () => {
    setFilters(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }))
  }

  const clearOldLogs = async () => {
    if (!confirm('Удалить логи старше 30 дней?')) return

    try {
      const response = await fetch('/api/admin/logs?daysOld=30', {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        alert('Старые логи удалены')
        fetchLogs()
      } else {
        alert('Ошибка удаления логов')
      }
    } catch (err) {
      alert('Ошибка удаления логов')
    }
  }

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR: return 'text-red-600 bg-red-50'
      case LogLevel.WARN: return 'text-yellow-600 bg-yellow-50'
      case LogLevel.INFO: return 'text-blue-600 bg-blue-50'
      case LogLevel.DEBUG: return 'text-purple-600 bg-purple-50'
      case LogLevel.TRACE: return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getCategoryColor = (category: LogCategory) => {
    const colors = {
      [LogCategory.SYSTEM]: 'bg-gray-100 text-gray-800',
      [LogCategory.AI]: 'bg-green-100 text-green-800',
      [LogCategory.ACTIONS]: 'bg-blue-100 text-blue-800',
      [LogCategory.CHARACTERISTICS]: 'bg-purple-100 text-purple-800',
      [LogCategory.MEMORY]: 'bg-pink-100 text-pink-800',
      [LogCategory.CHAT]: 'bg-indigo-100 text-indigo-800',
      [LogCategory.API]: 'bg-orange-100 text-orange-800',
      [LogCategory.DATABASE]: 'bg-red-100 text-red-800',
      [LogCategory.AUTH]: 'bg-yellow-100 text-yellow-800',
      [LogCategory.GAME]: 'bg-teal-100 text-teal-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Система логирования</h1>

        {/* Фильтры */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Категория
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Выберите категорию логов"
            >
              <option value="">Все категории</option>
              {Object.values(LogCategory).map(category => (
                <option key={category} value={category}>
                  {category.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Уровень
            </label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Выберите уровень логов"
            >
              <option value="">Все уровни</option>
              {Object.values(LogLevel).map(level => (
                <option key={level} value={level}>
                  {level.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Количество
            </label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Выберите количество логов"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Загрузка...' : 'Обновить'}
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-md ${
                autoRefresh
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {autoRefresh ? 'Авто ВКЛ' : 'Авто ВЫКЛ'}
            </button>
          </div>
        </div>

        {/* Действия */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Показано {logs.length} из {total} записей
          </div>

          <button
            onClick={clearOldLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Очистить старые логи
          </button>
        </div>
      </div>

      {/* Логи */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {logs.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-500">
              Логи не найдены
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCategoryColor(log.category)}`}>
                          {log.category.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </span>
                      </div>

                      <p className="text-sm text-gray-900 mb-2">{log.message}</p>

                      {log.data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                            Данные
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}

                      {(log.userId || log.characterId || log.sessionId || log.requestId) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                          {log.userId && <span>User: {log.userId}</span>}
                          {log.characterId && <span>Character: {log.characterId}</span>}
                          {log.sessionId && <span>Session: {log.sessionId}</span>}
                          {log.requestId && <span>Request: {log.requestId}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasMore && (
          <div className="p-4 border-t border-gray-200 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              Загрузить еще
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsViewer
