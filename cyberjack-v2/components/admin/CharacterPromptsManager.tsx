"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2, Edit, Plus, Eye, Copy, Save, X, RefreshCw, Play } from 'lucide-react'
import { PromptCategory, PromptVariableType } from '@/types/character-ai'

interface Character {
  id: string
  name: string
  description: string | null
  prompts: any
}

interface PromptTemplate {
  id: string
  name: string
  description: string
  category: PromptCategory
  template: string
  variables: PromptVariable[]
  isActive: boolean
  priority: number
}

interface PromptVariable {
  name: string
  type: PromptVariableType
  required: boolean
  defaultValue?: string
  description: string
}

interface CharacterPrompt {
  id: string
  templateId: string
  template: PromptTemplate
  customTemplate?: string
  isActive: boolean
  priority: number
  variables: Record<string, any>
  createdAt: string
  updatedAt: string
}

const CATEGORY_LABELS = {
  [PromptCategory.CHARACTER_DESCRIPTION]: 'Описание персонажа',
  [PromptCategory.CHARACTERISTICS]: 'Характеристики',
  [PromptCategory.MEMORY]: 'Память',
  [PromptCategory.CONTEXT]: 'Контекст',
  [PromptCategory.RESPONSE_STYLE]: 'Стиль ответа',
  [PromptCategory.EMOTION]: 'Эмоции',
  [PromptCategory.SITUATION]: 'Ситуация',
  [PromptCategory.INTERACTION]: 'Взаимодействие'
}

interface CharacterPromptsManagerProps {
  character: Character
  onUpdate?: () => void
}

export function CharacterPromptsManager({ character, onUpdate }: CharacterPromptsManagerProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [characterPrompts, setCharacterPrompts] = useState<CharacterPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewPrompt, setPreviewPrompt] = useState<CharacterPrompt | null>(null)
  const [testPrompt, setTestPrompt] = useState<string>('')

  const [formData, setFormData] = useState({
    templateId: '',
    customTemplate: '',
    isActive: true,
    priority: 50,
    variables: {} as Record<string, any>
  })

  useEffect(() => {
    loadData()
  }, [character.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [templatesRes, promptsRes] = await Promise.all([
        fetch('/api/admin/prompt-templates'),
        fetch(`/api/admin/characters/${character.id}/prompts`)
      ])

      if (!templatesRes.ok) throw new Error('Ошибка загрузки шаблонов')
      if (!promptsRes.ok) throw new Error('Ошибка загрузки промптов персонажа')

      const [templatesData, promptsData] = await Promise.all([
        templatesRes.json(),
        promptsRes.json()
      ])

      setTemplates(templatesData)
      setCharacterPrompts(promptsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingId
        ? `/api/admin/characters/${character.id}/prompts/${editingId}`
        : `/api/admin/characters/${character.id}/prompts`
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Ошибка сохранения промпта')

      await loadData()
      resetForm()
      onUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить промпт персонажа?')) return

    try {
      const response = await fetch(`/api/admin/characters/${character.id}/prompts/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Ошибка удаления')

      await loadData()
      onUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const handleEdit = (prompt: CharacterPrompt) => {
    setFormData({
      templateId: prompt.templateId,
      customTemplate: prompt.customTemplate || '',
      isActive: prompt.isActive,
      priority: prompt.priority,
      variables: prompt.variables
    })
    setEditingId(prompt.id)
    setShowForm(true)
  }

  const handleCopy = (prompt: CharacterPrompt) => {
    setFormData({
      templateId: prompt.templateId,
      customTemplate: prompt.customTemplate || '',
      isActive: prompt.isActive,
      priority: prompt.priority,
      variables: prompt.variables
    })
    setEditingId(null)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      templateId: '',
      customTemplate: '',
      isActive: true,
      priority: 50,
      variables: {}
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleTestPrompt = async () => {
    if (!testPrompt.trim()) return

    try {
      const response = await fetch(`/api/admin/characters/${character.id}/test-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testPrompt })
      })

      if (!response.ok) throw new Error('Ошибка тестирования промпта')

      const result = await response.json()
      alert(`Результат тестирования:\n\n${result.prompt}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка тестирования')
    }
  }

  const refreshDynamicPrompts = async () => {
    try {
      const response = await fetch(`/api/admin/characters/${character.id}/refresh-prompts`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Ошибка обновления промптов')

      await loadData()
      onUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления')
    }
  }

  const getCategoryBadgeColor = (category: PromptCategory) => {
    const colors = {
      [PromptCategory.CHARACTER_DESCRIPTION]: 'bg-blue-100 text-blue-800',
      [PromptCategory.CHARACTERISTICS]: 'bg-green-100 text-green-800',
      [PromptCategory.MEMORY]: 'bg-purple-100 text-purple-800',
      [PromptCategory.CONTEXT]: 'bg-yellow-100 text-yellow-800',
      [PromptCategory.RESPONSE_STYLE]: 'bg-red-100 text-red-800',
      [PromptCategory.EMOTION]: 'bg-pink-100 text-pink-800',
      [PromptCategory.SITUATION]: 'bg-indigo-100 text-indigo-800',
      [PromptCategory.INTERACTION]: 'bg-orange-100 text-orange-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const selectedTemplate = templates.find(t => t.id === formData.templateId)

  if (loading) return <div className="p-6">Загрузка...</div>
  if (error) return <div className="p-6 text-red-600">Ошибка: {error}</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Промпты персонажа: {character.name}</h2>
          <p className="text-gray-600">Настройка промптов для ИИ-персонажа</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshDynamicPrompts}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить динамические
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить промпт
          </Button>
        </div>
      </div>

      <Tabs defaultValue="prompts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompts">Промпты персонажа</TabsTrigger>
          <TabsTrigger value="test">Тестирование</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-4">
          <div className="grid gap-4">
            {characterPrompts.map((prompt) => (
              <Card key={prompt.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {prompt.template.name}
                        <Badge className={getCategoryBadgeColor(prompt.template.category)}>
                          {CATEGORY_LABELS[prompt.template.category]}
                        </Badge>
                        {prompt.isActive ? (
                          <Badge variant="outline" className="text-green-600">Активен</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Неактивен</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{prompt.template.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewPrompt(prompt)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(prompt)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(prompt)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(prompt.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Приоритет: {prompt.priority} | Переменных: {Object.keys(prompt.variables).length}
                    </div>
                    {prompt.customTemplate && (
                      <div className="text-sm">
                        <strong>Кастомный шаблон:</strong>
                        <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono max-h-20 overflow-y-auto">
                          {prompt.customTemplate.substring(0, 200)}
                          {prompt.customTemplate.length > 200 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Тестирование промптов</CardTitle>
              <CardDescription>
                Тестирование работы промптов персонажа с примером сообщения
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testMessage">Тестовое сообщение</Label>
                <Textarea
                  id="testMessage"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Введите сообщение для тестирования промптов..."
                  rows={3}
                />
              </div>
              <Button onClick={handleTestPrompt} disabled={!testPrompt.trim()}>
                <Play className="w-4 h-4 mr-2" />
                Тестировать промпты
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Форма создания/редактирования */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Редактировать промпт' : 'Добавить промпт'}
            </DialogTitle>
            <DialogDescription>
              Настройка промпта для персонажа {character.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateId">Шаблон</Label>
              <Select
                value={formData.templateId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, templateId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({CATEGORY_LABELS[template.category]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Приоритет</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 50 }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Активен</Label>
              </div>
            </div>

            {selectedTemplate && (
              <div className="space-y-2">
                <Label htmlFor="customTemplate">Кастомный шаблон (опционально)</Label>
                <Textarea
                  id="customTemplate"
                  value={formData.customTemplate}
                  onChange={(e) => setFormData(prev => ({ ...prev, customTemplate: e.target.value }))}
                  rows={6}
                  placeholder={`Базовый шаблон:\n${selectedTemplate.template}`}
                  className="font-mono"
                />
                <p className="text-sm text-gray-600">
                  Если оставить пустым, будет использован базовый шаблон
                </p>
              </div>
            )}

            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <div className="space-y-4">
                <Label>Переменные</Label>
                <div className="space-y-2">
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      <Label htmlFor={`var-${variable.name}`}>
                        {variable.name} {variable.required && '*'}
                      </Label>
                      <Input
                        id={`var-${variable.name}`}
                        value={formData.variables[variable.name] || variable.defaultValue || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          variables: {
                            ...prev.variables,
                            [variable.name]: e.target.value
                          }
                        }))}
                        placeholder={variable.description}
                      />
                      <p className="text-xs text-gray-500">
                        {variable.description} ({variable.type})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Отмена
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Обновить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Предварительный просмотр */}
      <Dialog open={!!previewPrompt} onOpenChange={() => setPreviewPrompt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Предварительный просмотр: {previewPrompt?.template.name}</DialogTitle>
            <DialogDescription>{previewPrompt?.template.description}</DialogDescription>
          </DialogHeader>

          {previewPrompt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Категория</Label>
                  <div className="p-2 bg-gray-50 rounded">
                    {CATEGORY_LABELS[previewPrompt.template.category]}
                  </div>
                </div>
                <div>
                  <Label>Приоритет</Label>
                  <div className="p-2 bg-gray-50 rounded">
                    {previewPrompt.priority}
                  </div>
                </div>
              </div>

              <div>
                <Label>Шаблон</Label>
                <div className="p-4 bg-gray-50 rounded font-mono text-sm whitespace-pre-wrap">
                  {previewPrompt.customTemplate || previewPrompt.template.template}
                </div>
              </div>

              {Object.keys(previewPrompt.variables).length > 0 && (
                <div>
                  <Label>Переменные</Label>
                  <div className="space-y-2">
                    {Object.entries(previewPrompt.variables).map(([name, value]) => (
                      <div key={name} className="p-2 border rounded">
                        <div className="font-medium">{name}</div>
                        <div className="text-sm text-gray-600">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
