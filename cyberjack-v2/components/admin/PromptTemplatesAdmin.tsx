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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Trash2, Edit, Plus, Eye, Copy, Save, X } from 'lucide-react'
import { PromptCategory, PromptVariableType } from '@/types/character-ai'

interface PromptTemplate {
  id: string
  name: string
  description: string
  category: PromptCategory
  template: string
  variables: PromptVariable[]
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

interface PromptVariable {
  name: string
  type: PromptVariableType
  required: boolean
  defaultValue?: string
  description: string
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

const VARIABLE_TYPE_LABELS = {
  [PromptVariableType.STRING]: 'Строка',
  [PromptVariableType.NUMBER]: 'Число',
  [PromptVariableType.BOOLEAN]: 'Булево',
  [PromptVariableType.ARRAY]: 'Массив',
  [PromptVariableType.OBJECT]: 'Объект'
}

export function PromptTemplatesAdmin() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<PromptTemplate | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: PromptCategory.CHARACTER_DESCRIPTION,
    template: '',
    isActive: true,
    priority: 50,
    variables: [] as PromptVariable[]
  })

  const [newVariable, setNewVariable] = useState({
    name: '',
    type: PromptVariableType.STRING,
    required: false,
    defaultValue: '',
    description: ''
  })

  const [showVariableForm, setShowVariableForm] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/prompt-templates')
      if (!response.ok) throw new Error('Ошибка загрузки шаблонов')
      const data = await response.json()
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingId ? `/api/admin/prompt-templates/${editingId}` : '/api/admin/prompt-templates'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Ошибка сохранения шаблона')

      await loadTemplates()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return

    try {
      const response = await fetch(`/api/admin/prompt-templates/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Ошибка удаления')

      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const handleEdit = (template: PromptTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      template: template.template,
      isActive: template.isActive,
      priority: template.priority,
      variables: template.variables
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleCopy = (template: PromptTemplate) => {
    setFormData({
      name: `${template.name} (копия)`,
      description: template.description,
      category: template.category,
      template: template.template,
      isActive: template.isActive,
      priority: template.priority,
      variables: template.variables
    })
    setEditingId(null)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: PromptCategory.CHARACTER_DESCRIPTION,
      template: '',
      isActive: true,
      priority: 50,
      variables: []
    })
    setEditingId(null)
    setShowForm(false)
    setShowVariableForm(false)
  }

  const addVariable = () => {
    if (!newVariable.name.trim()) return

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, { ...newVariable }]
    }))

    setNewVariable({
      name: '',
      type: PromptVariableType.STRING,
      required: false,
      defaultValue: '',
      description: ''
    })
    setShowVariableForm(false)
  }

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }))
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

  if (loading) return <div className="p-6">Загрузка...</div>
  if (error) return <div className="p-6 text-red-600">Ошибка: {error}</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Управление шаблонами промптов</h1>
          <p className="text-gray-600">Создание и редактирование шаблонов для ИИ-персонажей</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать шаблон
        </Button>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
          <TabsTrigger value="categories">По категориям</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        <Badge className={getCategoryBadgeColor(template.category)}>
                          {CATEGORY_LABELS[template.category]}
                        </Badge>
                        {template.isActive ? (
                          <Badge variant="outline" className="text-green-600">Активен</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Неактивен</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(template)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
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
                      Приоритет: {template.priority} | Переменных: {template.variables.length}
                    </div>
                    <div className="text-sm">
                      <strong>Шаблон:</strong>
                      <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono max-h-20 overflow-y-auto">
                        {template.template.substring(0, 200)}
                        {template.template.length > 200 && '...'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
            const categoryTemplates = templates.filter(t => t.category === category)
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {label}
                    <Badge variant="outline">{categoryTemplates.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {categoryTemplates.map((template) => (
                      <div key={template.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-gray-600">{template.description}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewTemplate(template)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>

      {/* Форма создания/редактирования */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Редактировать шаблон' : 'Создать шаблон'}
            </DialogTitle>
            <DialogDescription>
              Создание или редактирование шаблона промпта для ИИ-персонажей
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Категория</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as PromptCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
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

            <div className="space-y-2">
              <Label htmlFor="template">Шаблон</Label>
              <Textarea
                id="template"
                value={formData.template}
                onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
                rows={8}
                placeholder="Введите шаблон промпта. Используйте {{variableName}} для переменных."
                className="font-mono"
              />
            </div>

            {/* Переменные */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Переменные</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVariableForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить переменную
                </Button>
              </div>

              {formData.variables.length > 0 && (
                <div className="space-y-2">
                  {formData.variables.map((variable, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{variable.name}</div>
                        <div className="text-sm text-gray-600">
                          {VARIABLE_TYPE_LABELS[variable.type]} {variable.required && '(обязательная)'}
                        </div>
                        <div className="text-xs text-gray-500">{variable.description}</div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeVariable(index)}
                        className="text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {showVariableForm && (
                <div className="p-4 border rounded space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="varName">Имя переменной</Label>
                      <Input
                        id="varName"
                        value={newVariable.name}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="characterName"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="varType">Тип</Label>
                      <Select
                        value={newVariable.type}
                        onValueChange={(value) => setNewVariable(prev => ({ ...prev, type: value as PromptVariableType }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VARIABLE_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="varDescription">Описание</Label>
                    <Input
                      id="varDescription"
                      value={newVariable.description}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Описание переменной"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="varDefault">Значение по умолчанию</Label>
                      <Input
                        id="varDefault"
                        value={newVariable.defaultValue}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, defaultValue: e.target.value }))}
                        placeholder="Значение по умолчанию"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="varRequired"
                        checked={newVariable.required}
                        onCheckedChange={(checked) => setNewVariable(prev => ({ ...prev, required: checked }))}
                      />
                      <Label htmlFor="varRequired">Обязательная</Label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" onClick={addVariable}>
                      <Save className="w-4 h-4 mr-2" />
                      Добавить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowVariableForm(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Отмена
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Обновить' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Предварительный просмотр */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Предварительный просмотр: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>{previewTemplate?.description}</DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Категория</Label>
                  <div className="p-2 bg-gray-50 rounded">
                    {CATEGORY_LABELS[previewTemplate.category]}
                  </div>
                </div>
                <div>
                  <Label>Приоритет</Label>
                  <div className="p-2 bg-gray-50 rounded">
                    {previewTemplate.priority}
                  </div>
                </div>
              </div>

              <div>
                <Label>Шаблон</Label>
                <div className="p-4 bg-gray-50 rounded font-mono text-sm whitespace-pre-wrap">
                  {previewTemplate.template}
                </div>
              </div>

              {previewTemplate.variables.length > 0 && (
                <div>
                  <Label>Переменные</Label>
                  <div className="space-y-2">
                    {previewTemplate.variables.map((variable, index) => (
                      <div key={index} className="p-2 border rounded">
                        <div className="font-medium">{variable.name}</div>
                        <div className="text-sm text-gray-600">
                          {VARIABLE_TYPE_LABELS[variable.type]} {variable.required && '(обязательная)'}
                        </div>
                        <div className="text-xs text-gray-500">{variable.description}</div>
                        {variable.defaultValue && (
                          <div className="text-xs text-blue-600">
                            По умолчанию: {variable.defaultValue}
                          </div>
                        )}
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
