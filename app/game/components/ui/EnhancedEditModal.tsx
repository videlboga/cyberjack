import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Save } from "lucide-react"
import { FieldConfig, getFieldConfig, getEntityDisplayName } from "@/lib/field-configs"
import { PromptManager } from './PromptManager'

interface EnhancedEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  entityType: string
  initialData?: any
  isNew?: boolean
}



// Используем новую систему конфигурации полей
const generateDynamicFieldConfig = (entityType: string): FieldConfig[] => {
  return getFieldConfig(entityType)
}

export const EnhancedEditModal: React.FC<EnhancedEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  entityType,
  initialData,
  isNew = false
}) => {
  const [formData, setFormData] = useState<any>({})
  const [activeTab, setActiveTab] = useState('basic')

  // Динамически генерируем конфигурацию полей
  const fields = generateDynamicFieldConfig(entityType)

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || {})
      setActiveTab('basic')
    }
  }, [isOpen, initialData])

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev: Record<string, any>) => ({
      ...prev,
      [fieldName]: value
    }))
  }

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  // Рендеринг динамических объектов (атрибуты, фетиши и т.д.)
  const renderDynamicObject = (field: FieldConfig) => {
    const value = formData[field.name] || {}
    const config = field.dynamicConfig!

    const handleDynamicChange = (key: string, val: any) => {
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        [field.name]: {
          ...prev[field.name],
          [key]: val
        }
      }))
    }

    const handleRemoveKey = (key: string) => {
      const newValue = { ...value }
      delete newValue[key]
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        [field.name]: newValue
      }))
    }

    const handleAddKey = () => {
      const newKey = config.options?.[0] || 'new_key'
      const defaultValue = config.type === 'attributes' || config.type === 'fetishes' || config.type === 'characteristics' || config.type === 'skills' ? 1 : 
                          config.type === 'condition' || config.type === 'states' ? 50 : ''
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        [field.name]: {
          ...prev[field.name],
          [newKey]: defaultValue
        }
      }))
    }

    return (
      <div key={field.name} className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Button
            type="button"
            size="sm"
            onClick={handleAddKey}
            className="h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Добавить
          </Button>
        </div>

        <div className="space-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <Select
                value={key}
                onValueChange={(newKey) => {
                  const newValue = { ...value }
                  delete newValue[key]
                  newValue[newKey] = val
                  setFormData((prev: Record<string, any>) => ({
                    ...prev,
                    [field.name]: newValue
                  }))
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.options?.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {config.type === 'attributes' || config.type === 'fetishes' ? (
                <Input
                  type="number"
                  value={val as number}
                  onChange={(e) => handleDynamicChange(key, Number(e.target.value))}
                  min={config.min}
                  max={config.max}
                  className="flex-1"
                />
              ) : config.type === 'condition' ? (
                <Input
                  type="number"
                  value={val as number}
                  onChange={(e) => handleDynamicChange(key, Number(e.target.value))}
                  min={0}
                  max={100}
                  className="flex-1"
                />
              ) : config.type === 'characteristics' ? (
                <Input
                  type="number"
                  value={val as number}
                  onChange={(e) => handleDynamicChange(key, Number(e.target.value))}
                  min={0}
                  max={10}
                  className="flex-1"
                />
              ) : config.type === 'skills' ? (
                <Input
                  type="number"
                  value={val as number}
                  onChange={(e) => handleDynamicChange(key, Number(e.target.value))}
                  min={0}
                  max={10}
                  className="flex-1"
                />
              ) : (
                <Input
                  value={val as string}
                  onChange={(e) => handleDynamicChange(key, e.target.value)}
                  className="flex-1"
                />
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleRemoveKey(key)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {field.description && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}
      </div>
    )
  }

  // Рендеринг динамических массивов (черты характера, режимы и т.д.)
  const renderDynamicArray = (field: FieldConfig) => {
    const value = formData[field.name] || []
    const config = field.dynamicConfig!

    const handleAddItem = () => {
      const newItem = config.options?.[0] || 'new_item'
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        [field.name]: [...(prev[field.name] || []), newItem]
      }))
    }

    const handleRemoveItem = (index: number) => {
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        [field.name]: prev[field.name].filter((_: any, i: number) => i !== index)
      }))
    }

    const handleChangeItem = (index: number, newValue: string) => {
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        [field.name]: prev[field.name].map((item: any, i: number) => i === index ? newValue : item)
      }))
    }

    return (
      <div key={field.name} className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Button
            type="button"
            size="sm"
            onClick={handleAddItem}
            className="h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Добавить
          </Button>
        </div>

        <div className="space-y-2">
          {value.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={item}
                onValueChange={(newValue) => handleChangeItem(index, newValue)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.options?.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleRemoveItem(index)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {field.description && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}
      </div>
    )
  }

  const renderField = (field: FieldConfig) => {
    const value = formData[field.name] || ''

    switch (field.type) {
      case 'text':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
            />
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
            />
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'number':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="number"
              value={value}
              onChange={(e) => handleInputChange(field.name, Number(e.target.value))}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder}
            />
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleInputChange(field.name, val)}>
              <SelectTrigger>
                <SelectValue placeholder={`Выберите ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'slider':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}: {value}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Slider
              value={[value]}
              onValueChange={([val]) => handleInputChange(field.name, val)}
              min={field.min}
              max={field.max}
              step={field.step}
              className="w-full"
            />
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case 'switch':
        return (
          <div key={field.name} className="flex items-center space-x-2">
            <Switch
              id={field.name}
              checked={value}
              onCheckedChange={(checked) => handleInputChange(field.name, checked)}
            />
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground ml-2">{field.description}</p>
            )}
          </div>
        )

      case 'dynamic-object':
        return renderDynamicObject(field)

      case 'dynamic-array':
        return renderDynamicArray(field)

      case 'object':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  handleInputChange(field.name, parsed)
                } catch {
                  // Игнорируем ошибки парсинга
                }
              }}
              placeholder="{}"
              rows={4}
            />
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Введите JSON объект. Пример: {"{"}"key": "value"{"}"}
            </p>
          </div>
        )

      case 'array':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  handleInputChange(field.name, parsed)
                } catch {
                  // Игнорируем ошибки парсинга
                }
              }}
              placeholder="[]"
              rows={3}
            />
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Введите JSON массив. Пример: ["item1", "item2"]
            </p>
          </div>
        )

      default:
        return null
    }
  }

  const basicFields = fields.filter(f => ['text', 'textarea', 'number', 'select', 'slider', 'switch'].includes(f.type))
  const advancedFields = fields.filter(f => ['object', 'array', 'dynamic-object', 'dynamic-array'].includes(f.type))
  
  // Специальная обработка для персонажей - три вкладки
  const isCharacter = entityType === 'characters' || entityType === 'character'
  const characterBasicFields = isCharacter ? fields.filter(f => ['text', 'textarea', 'number', 'select'].includes(f.type)) : basicFields
  const characterPromptFields = isCharacter ? [
    { name: 'basePrompt', type: 'textarea' as const, label: 'Базовый промт', required: false, placeholder: 'Базовый промт для Character AI' },
    { name: 'characteristicInterpretations', type: 'textarea' as const, label: 'Интерпретации характеристик', required: false, placeholder: 'Описание влияния характеристик на поведение' },
    { name: 'situationalPrompts', type: 'textarea' as const, label: 'Ситуативные промты', required: false, placeholder: 'Промты для различных ситуаций' }
  ] : []
  const characterAdvancedFields = isCharacter ? fields.filter(f => ['dynamic-object', 'dynamic-array'].includes(f.type)) : advancedFields

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'Создать' : 'Редактировать'} {getEntityDisplayName(entityType)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isCharacter ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Основные поля</TabsTrigger>
                <TabsTrigger value="prompts">Промты</TabsTrigger>
                <TabsTrigger value="advanced">Характеристики</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-4">
                {characterBasicFields.map(renderField)}
              </TabsContent>
              <TabsContent value="prompts" className="space-y-4">
                <PromptManager 
                  character={formData} 
                  onUpdate={(updates) => setFormData(updates)} 
                />
              </TabsContent>
              <TabsContent value="advanced" className="space-y-4">
                {characterAdvancedFields.map(renderField)}
              </TabsContent>
            </Tabs>
          ) : advancedFields.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Основные поля</TabsTrigger>
                <TabsTrigger value="advanced">Дополнительные поля</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                {basicFields.map(renderField)}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                {advancedFields.map(renderField)}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              {fields.map(renderField)}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
