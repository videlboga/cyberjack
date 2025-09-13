// app/(auth)/db/page.tsx

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CharacterList } from '@/components/admin/CharacterList'
import { prisma } from '@/lib/db/client'

async function getDatabaseStats() {
  const [characters, users, characteristics, actions, poses] = await Promise.all([
    prisma.character.count(),
    prisma.user.count(),
    prisma.characteristicDefinition.count(),
    prisma.action.count(),
    prisma.poseDefinition.count()
  ])

  const activeCharacters = await prisma.character.count({
    where: { isActive: true }
  })

  const adminUsers = await prisma.user.count({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
  })

  return {
    characters: { total: characters, active: activeCharacters },
    users: { total: users, admins: adminUsers },
    system: { characteristics, actions, poses }
  }
}

export default async function DatabaseInterface() {
  // Получаем статистику из базы данных
  const stats = await getDatabaseStats()
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Интерфейс базы данных</h1>
        <p className="text-gray-600">Управление персонажами, пользователями и системными настройками</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Персонажи</h2>
            <p className="text-gray-600">Управление персонажами и их характеристиками</p>
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span>Всего персонажей:</span>
              <span className="font-medium">{stats.characters.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Активных:</span>
              <span className="font-medium text-green-600">{stats.characters.active}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Неактивных:</span>
              <span className="font-medium text-red-600">{stats.characters.total - stats.characters.active}</span>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/db/characters">Открыть</Link>
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Пользователи</h2>
            <p className="text-gray-600">Управление пользователями и их данными</p>
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span>Всего пользователей:</span>
              <span className="font-medium">{stats.users.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Админов:</span>
              <span className="font-medium text-blue-600">{stats.users.admins}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Обычных:</span>
              <span className="font-medium">{stats.users.total - stats.users.admins}</span>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/db/users">Открыть</Link>
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Система</h2>
            <p className="text-gray-600">Системные настройки и конфигурации</p>
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span>Характеристик:</span>
              <span className="font-medium">{stats.system.characteristics}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Действий:</span>
              <span className="font-medium">{stats.system.actions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Поз:</span>
              <span className="font-medium">{stats.system.poses}</span>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/db/system">Открыть</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button variant="outline" className="h-auto p-4 flex flex-col items-center">
            <span className="text-2xl mb-2">➕</span>
            <span>Создать персонажа</span>
          </Button>
          <Button variant="outline" className="h-auto p-4 flex flex-col items-center">
            <span className="text-2xl mb-2">👤</span>
            <span>Добавить пользователя</span>
          </Button>
          <Button variant="outline" className="h-auto p-4 flex flex-col items-center">
            <span className="text-2xl mb-2">📊</span>
            <span>Создать характеристику</span>
          </Button>
          <Button variant="outline" className="h-auto p-4 flex flex-col items-center">
            <span className="text-2xl mb-2">⚡</span>
            <span>Создать действие</span>
          </Button>
        </div>
      </div>

      {/* Список персонажей */}
      <div className="mt-8">
        <CharacterList />
      </div>
    </div>
  )
}
