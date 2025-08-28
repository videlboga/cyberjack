"use client"

import { useState } from 'react'

export default function ProdTestPage() {
  const [activeSection, setActiveSection] = useState<'lab' | 'station'>('lab')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/30 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">Nexus Enslaver - Продакшн</h1>
          <div className="text-sm text-gray-300">Тестовая версия</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveSection('lab')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeSection === 'lab'
              ? 'bg-cyan-600 text-white border-b-2 border-cyan-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🧪 Лаборатория
        </button>
        <button
          onClick={() => setActiveSection('station')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeSection === 'station'
              ? 'bg-cyan-600 text-white border-b-2 border-cyan-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🚀 Станция
        </button>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {activeSection === 'lab' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-cyan-400">Лаборатория - Работа с Активами</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Левая панель - Портреты активов */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-400">Доступные Активы</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-4 rounded-lg border border-cyan-500/30 cursor-pointer hover:border-cyan-400 transition-colors">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">Т1</span>
                    </div>
                    <p className="text-center text-sm">Тестовый Актив 1</p>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg border border-cyan-500/30 cursor-pointer hover:border-cyan-400 transition-colors">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">Т2</span>
                    </div>
                    <p className="text-center text-sm">Тестовый Актив 2</p>
                  </div>
                </div>
              </div>

              {/* Центральная панель - Сцена */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-400">Интерактивная Сцена</h3>
                <div className="bg-gray-800 p-6 rounded-lg border border-cyan-500/30 h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">🎭</span>
                    </div>
                    <p className="text-gray-300">Интерактивная сцена актива</p>
                  </div>
                </div>
              </div>

              {/* Правая панель - Панель управления */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-400">Панель Управления</h3>
                <div className="space-y-3">
                  <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition-colors">
                    💬 Чат с AI
                  </button>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors">
                    🛠️ Действия и Инструменты
                  </button>
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors">
                    📊 Характеристики
                  </button>
                  <button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded transition-colors">
                    🔧 Оборудование
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'station' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-cyan-400">Станция - Сюжетные Взаимодействия</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-800 p-6 rounded-lg border border-cyan-500/30">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">🏪</span>
                  </div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2">Talent Exchange</h3>
                  <p className="text-gray-300 text-sm mb-4">Обмен и торговля талантами</p>
                  <button className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition-colors">
                    Открыть
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-cyan-500/30">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">🌌</span>
                  </div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2">Void Border</h3>
                  <p className="text-gray-300 text-sm mb-4">Исследование пустоты</p>
                  <button className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition-colors">
                    Открыть
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-cyan-500/30">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">🏭</span>
                  </div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2">Corporate Lab</h3>
                  <p className="text-gray-300 text-sm mb-4">Корпоративная лаборатория</p>
                  <button className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition-colors">
                    Открыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-cyan-500/30 p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-cyan-400">День 1</span>
            <span className="text-green-400">1000 кредитов</span>
            <span className="text-purple-400">Репутация: 50%</span>
          </div>
          <button className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 text-white px-4 py-2 rounded transition-colors">
            Следующий день
          </button>
        </div>
      </div>
    </div>
  )
}
