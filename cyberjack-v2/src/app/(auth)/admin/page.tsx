// app/(auth)/admin/page.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CharacteristicsAdmin } from '@/components/admin/CharacteristicsAdmin'

export default function AdminPanel() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Админ-панель</h1>
        <p className="text-gray-600">Настройка характеристик, действий, поз и сюжетных элементов</p>
      </div>

      <Tabs defaultValue="characteristics" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
          <TabsTrigger value="actions">Действия</TabsTrigger>
          <TabsTrigger value="poses">Позы</TabsTrigger>
          <TabsTrigger value="anatomy">Анатомия</TabsTrigger>
          <TabsTrigger value="story">Сюжет</TabsTrigger>
        </TabsList>

        <TabsContent value="characteristics" className="mt-6">
          <CharacteristicsAdmin />
        </TabsContent>

        <TabsContent value="actions" className="mt-6">
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Управление действиями</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                Создать действие
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <p>Список действий будет здесь</p>
              <p className="text-sm mt-2">Функция в разработке</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="poses" className="mt-6">
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Управление позами</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                Создать позу
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <p>Список поз будет здесь</p>
              <p className="text-sm mt-2">Функция в разработке</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="anatomy" className="mt-6">
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Управление анатомией</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                Создать анатомию
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <p>Список анатомических частей будет здесь</p>
              <p className="text-sm mt-2">Функция в разработке</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="story" className="mt-6">
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Сюжетный конструктор</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                Создать сюжетную точку
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <p>Сюжетный конструктор будет здесь</p>
              <p className="text-sm mt-2">Функция в разработке</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
