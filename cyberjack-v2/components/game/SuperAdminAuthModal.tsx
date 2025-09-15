"use client"

import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface SuperAdminAuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SuperAdminAuthModal({ isOpen, onClose }: SuperAdminAuthModalProps) {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false
      })

      if (result?.error) {
        setError('Неверные данные для входа')
      } else {
        onClose()
      }
    } catch (error) {
      setError('Ошибка авторизации')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">🔐 Авторизация</h2>
          <p className="text-gray-400">Войдите как суперадмин для доступа к игровому интерфейсу</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@cyberjack.local"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Пароль
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-800 rounded-md">
          <h3 className="text-sm font-medium text-gray-300 mb-2">📋 Данные для входа:</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <div><strong>Email:</strong> admin@cyberjack.local</div>
            <div><strong>Пароль:</strong> demo123</div>
          </div>
        </div>
      </div>
    </div>
  )
}
