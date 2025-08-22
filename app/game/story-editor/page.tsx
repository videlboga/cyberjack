'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  Target, 
  Settings, 
  Play, 
  Save, 
  Download, 
  Upload,
  Eye,
  Edit,
  Zap,
  ArrowLeft,
  Plus,
  FolderOpen
} from "lucide-react"
import Link from "next/link"
import { StoryEditor } from "../components/story/StoryEditor"
import { StoryPointsManager } from "../components/story/StoryPointsManager"
import { StoryPreview } from "../components/story/StoryPreview"
import { StoryWorkspaceManager } from "../components/story/StoryWorkspaceManager"

// Импортируем данные
import storyScenesData from "../../../data/story-scenes.json"

export default function StoryEditorPage() {
  const [storyData, setStoryData] = useState(storyScenesData)
  const [activeTab, setActiveTab] = useState<'workspaces' | 'visual' | 'storypoints' | 'triggers' | 'preview' | 'settings'>('workspaces')
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Состояние рабочих областей
  const [workspaces, setWorkspaces] = useState<Record<string, any>>({
    'default': {
      id: 'default',
      name: 'Основная область',
      description: 'Рабочая область по умолчанию для всех сцен',
      type: 'scene',
      scenes: Object.keys(storyScenesData.scenes || {}),
      storyPoints: Object.keys(storyScenesData.storyPoints || {}),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      isActive: true
    }
  })
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('default')
  
  // Данные для каждой рабочей области
  const [workspaceData, setWorkspaceData] = useState<Record<string, any>>({
    'default': storyScenesData
  })

  // Обработчики изменений
  const handleStoryDataChange = (newData: any) => {
    setStoryData(newData)
    // Сохраняем изменения в активной рабочей области
    setWorkspaceData(prev => ({
      ...prev,
      [activeWorkspaceId]: newData
    }))
    // Обновляем метаданные рабочей области
    setWorkspaces(prev => ({
      ...prev,
      [activeWorkspaceId]: {
        ...prev[activeWorkspaceId],
        lastModified: new Date().toISOString(),
        scenes: Object.keys(newData.scenes || {}),
        storyPoints: Object.keys(newData.storyPoints || {})
      }
    }))
    setHasUnsavedChanges(true)
  }

  const handleStoryPointsUpdate = (storyPoints: any) => {
    const updatedData = {
      ...storyData,
      storyPoints
    }
    setStoryData(updatedData)
    // Сохраняем изменения в активной рабочей области
    setWorkspaceData(prev => ({
      ...prev,
      [activeWorkspaceId]: updatedData
    }))
    // Обновляем метаданные рабочей области
    setWorkspaces(prev => ({
      ...prev,
      [activeWorkspaceId]: {
        ...prev[activeWorkspaceId],
        lastModified: new Date().toISOString(),
        storyPoints: Object.keys(storyPoints || {})
      }
    }))
    setHasUnsavedChanges(true)
  }

  const handleTriggersUpdate = (triggers: any) => {
    const updatedData = {
      ...storyData,
      triggers
    }
    setStoryData(updatedData)
    // Сохраняем изменения в активной рабочей области
    setWorkspaceData(prev => ({
      ...prev,
      [activeWorkspaceId]: updatedData
    }))
    setHasUnsavedChanges(true)
  }

  const handleSave = () => {
    try {
      // Создаем улучшенную версию данных с метаданными
      const dataToSave = {
        ...storyData,
        metadata: {
          version: "1.0",
          lastModified: new Date().toISOString(),
          totalScenes: storyData.scenes?.length || 0,
          totalStoryPoints: Object.keys(storyData.storyPoints || {}).length
        }
      }
      
      console.log('Сохранение данных:', dataToSave)
      
      // Симуляция сохранения - в реальном приложении здесь был бы API вызов
      localStorage.setItem('cyberjack-story-data', JSON.stringify(dataToSave))
      setHasUnsavedChanges(false)
      
      // Показываем уведомление об успешном сохранении
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50'
      notification.textContent = 'Данные успешно сохранены!'
      document.body.appendChild(notification)
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 3000)
      
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
      alert('Ошибка при сохранении данных')
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(storyData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'story-data.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          setStoryData(importedData)
          setHasUnsavedChanges(true)
        } catch (error) {
          console.error('Ошибка при импорте файла:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  // Функции управления рабочими областями
  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId)
    // Загружаем данные активной рабочей области
    if (workspaceData[workspaceId]) {
      setStoryData(workspaceData[workspaceId])
    } else {
      // Если данных нет, создаем пустую область
      const emptyData = {
        storyPoints: {},
        scenes: {}
      }
      setStoryData(emptyData)
      setWorkspaceData(prev => ({
        ...prev,
        [workspaceId]: emptyData
      }))
    }
  }

  const handleWorkspaceCreate = (workspace: any) => {
    const newWorkspaceId = `workspace_${Date.now()}`
    const newWorkspace = {
      ...workspace,
      id: newWorkspaceId,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
    
    // Создаем пустые данные для новой области
    const emptyData = {
      storyPoints: {},
      scenes: {}
    }
    
    setWorkspaces(prev => ({
      ...prev,
      [newWorkspaceId]: newWorkspace
    }))
    
    setWorkspaceData(prev => ({
      ...prev,
      [newWorkspaceId]: emptyData
    }))
    
    setActiveWorkspaceId(newWorkspaceId)
    setStoryData(emptyData)
    setActiveTab('visual')
  }

  const handleWorkspaceUpdate = (workspaceId: string, updates: any) => {
    setWorkspaces(prev => ({
      ...prev,
      [workspaceId]: {
        ...prev[workspaceId],
        ...updates,
        lastModified: new Date().toISOString()
      }
    }))
  }

  const handleWorkspaceDelete = (workspaceId: string) => {
    if (Object.keys(workspaces).length > 1) {
      const newWorkspaces = { ...workspaces }
      const newWorkspaceData = { ...workspaceData }
      
      delete newWorkspaces[workspaceId]
      delete newWorkspaceData[workspaceId]
      
      setWorkspaces(newWorkspaces)
      setWorkspaceData(newWorkspaceData)
      
      if (activeWorkspaceId === workspaceId) {
        const remainingWorkspaceId = Object.keys(newWorkspaces)[0]
        setActiveWorkspaceId(remainingWorkspaceId)
        setStoryData(newWorkspaceData[remainingWorkspaceId] || { storyPoints: {}, scenes: {} })
      }
    }
  }

  const handleWorkspaceDuplicate = (workspaceId: string) => {
    const originalWorkspace = workspaces[workspaceId]
    const originalData = workspaceData[workspaceId]
    const newWorkspaceId = `workspace_${Date.now()}`
    
    const newWorkspace = {
      ...originalWorkspace,
      id: newWorkspaceId,
      name: `${originalWorkspace.name} (копия)`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
    
    setWorkspaces(prev => ({
      ...prev,
      [newWorkspaceId]: newWorkspace
    }))
    
    setWorkspaceData(prev => ({
      ...prev,
      [newWorkspaceId]: JSON.parse(JSON.stringify(originalData)) // Глубокое копирование
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="flex items-center space-x-4">
            <Link href="/game">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к игре
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Сюжетный редактор</h1>
              {activeWorkspaceId && workspaces[activeWorkspaceId] && (
                <p className="text-sm text-muted-foreground">
                  Рабочая область: {workspaces[activeWorkspaceId].name}
                </p>
              )}
            </div>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Несохраненные изменения
              </Badge>
            )}
          </div>
          
          <div className="ml-auto flex items-center space-x-2">
            <Button
              variant={viewMode === 'edit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('edit')}
            >
              <Edit className="h-3 w-3 mr-1" />
              Редактирование
            </Button>
            <Button
              variant={viewMode === 'preview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('preview')}
            >
              <Eye className="h-3 w-3 mr-1" />
              Предпросмотр
            </Button>
            
            <div className="border-l pl-2 ml-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
              >
                <Save className="h-3 w-3 mr-1" />
                Сохранить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
              >
                <Download className="h-3 w-3 mr-1" />
                Экспорт
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Импортировать файл JSON"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="pointer-events-none"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Импорт
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-4rem)]">
          <div className="border-b px-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="workspaces" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Рабочие области
              </TabsTrigger>
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Визуальный редактор
              </TabsTrigger>
              <TabsTrigger value="storypoints" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Сюжетные точки
              </TabsTrigger>
              <TabsTrigger value="triggers" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Триггеры
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Предпросмотр
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Настройки
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="workspaces" className="h-full m-0">
            <StoryWorkspaceManager
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onWorkspaceChange={handleWorkspaceChange}
              onWorkspaceCreate={handleWorkspaceCreate}
              onWorkspaceUpdate={handleWorkspaceUpdate}
              onWorkspaceDelete={handleWorkspaceDelete}
              onWorkspaceDuplicate={handleWorkspaceDuplicate}
              onNavigateToVisual={() => setActiveTab('visual')}
            />
          </TabsContent>

          <TabsContent value="visual" className="h-full m-0">
            <StoryEditor
              storyData={storyData}
              onSave={handleStoryDataChange}
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onWorkspaceChange={handleWorkspaceChange}
            />
          </TabsContent>

          <TabsContent value="storypoints" className="h-full m-0">
            <StoryPointsManager
              storyPoints={storyData.storyPoints || {}}
              conditions={storyData.conditions || {}}
              triggers={storyData.triggers || {}}
              onUpdateStoryPoints={handleStoryPointsUpdate}
              onUpdateConditions={(conditions) => {
                setStoryData(prev => ({ ...prev, conditions }))
              }}
              onUpdateTriggers={(triggers) => {
                setStoryData(prev => ({ ...prev, triggers }))
              }}
            />
          </TabsContent>

          <TabsContent value="triggers" className="h-full m-0 p-4">
            <div className="h-full flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold mb-2">Управление триггерами</h2>
                <p className="text-muted-foreground">
                  Настройте автоматические триггеры, которые активируются при определенных условиях
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Триггеры сюжетных точек
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Триггеры, которые активируются при изменении значений сюжетных точек
                    </p>
                    <Button className="w-full">
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить триггер
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Условные триггеры
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Триггеры, основанные на комбинации различных условий
                    </p>
                    <Button className="w-full" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить условие
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Событийные триггеры
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Триггеры, связанные с игровыми событиями и действиями
                    </p>
                    <Button className="w-full" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить событие
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="h-full m-0">
            <StoryPreview storyData={storyData} />
          </TabsContent>

          <TabsContent value="settings" className="h-full m-0 p-4">
            <div className="h-full flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold mb-2">Настройки сюжетной системы</h2>
                <p className="text-muted-foreground">
                  Настройте параметры сюжетной системы и экспорта
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Общие настройки</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Автосохранение</label>
                      <p className="text-xs text-muted-foreground">
                        Автоматически сохранять изменения каждые 5 минут
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Валидация</label>
                      <p className="text-xs text-muted-foreground">
                        Проверять корректность связей между узлами
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Предпросмотр</label>
                      <p className="text-xs text-muted-foreground">
                        Показывать предварительный просмотр сцен
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Экспорт</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Формат экспорта</label>
                      <p className="text-xs text-muted-foreground">
                        JSON с полной структурой данных
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Сжатие</label>
                      <p className="text-xs text-muted-foreground">
                        Минифицировать JSON для уменьшения размера
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Версионирование</label>
                      <p className="text-xs text-muted-foreground">
                        Добавлять метаданные версии к экспорту
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
