"use client"

import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/ui/navbar'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (session) {
      const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
      router.push(isAdmin ? '/admin' : '/game')
    } else {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-6">
            CyberJack v2.0
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Новая версия системы управления персонажами с ИИ, характеристиками и интерактивными действиями
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-4">
                База данных
              </h2>
              <p className="text-gray-300 mb-6">
                Управление персонажами, пользователями и системными настройками
              </p>
              <a href="/db" className="inline-block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-center">
                Открыть БД
              </a>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Админ-панель
              </h2>
              <p className="text-gray-300 mb-6">
                Настройка характеристик, действий, поз и сюжетных элементов
              </p>
              <a href="/admin" className="inline-block w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-center">
                Админ-панель
              </a>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Игровой интерфейс
              </h2>
              <p className="text-gray-300 mb-6">
                Взаимодействие с персонажами, выполнение действий и чат с ИИ
              </p>
              <a href="/game" className="inline-block w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-center">
                Играть
              </a>
            </div>
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-2xl font-semibold text-white mb-8">
              Ключевые особенности
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🧠</span>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Character AI</h4>
                <p className="text-gray-400 text-sm">GLM 4.5 модель для реалистичных диалогов</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Характеристики</h4>
                <p className="text-gray-400 text-sm">100-балльная система с восстановлением</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⏱️</span>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Система времени</h4>
                <p className="text-gray-400 text-sm">Холд действий с автоматическим восстановлением</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎮</span>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Интерактивность</h4>
                <p className="text-gray-400 text-sm">Действия с эффектами и активными зонами</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}