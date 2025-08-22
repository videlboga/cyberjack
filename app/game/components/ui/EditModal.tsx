import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { getConfigSchema, createNewConfigItem } from '../../utils/configHelpers'
import { validateGameEntity } from '../../utils/validation'

export interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  entityType: keyof typeof getConfigSchema
  initialData?: any
  isNew?: boolean
}

export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  entityType,
  initialData,
  isNew = false
}) => {
  const [formData, setFormData] = useState<any>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const schema = getConfigSchema(entityType)

  useEffect(() => {
    if (isOpen) {
      if (isNew) {
        setFormData(createNewConfigItem(entityType))
      } else {
        setFormData(initialData || {})
      }
      setErrors({})
    }
  }, [isOpen, isNew, initialData, entityType])

  const updateField = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }))

    // Очищаем ошибку для этого поля
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const validationErrors = validateGameEntity(formData, entityType as any)
    setErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderField = (field: any) => {
    const fieldError = errors[field.name]
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
              onChange={(e) => updateField(field.name, e.target.value)}
              className={fieldError ? 'border-red-500' : ''}
            />
            {fieldError && (
              <p className="text-sm text-red-500">{fieldError}</p>
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
              onChange={(e) => updateField(field.name, e.target.value)}
              className={fieldError ? 'border-red-500' : ''}
              rows={3}
            />
            {fieldError && (
              <p className="text-sm text-red-500">{fieldError}</p>
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
              onChange={(e) => updateField(field.name, Number(e.target.value))}
              className={fieldError ? 'border-red-500' : ''}
            />
            {fieldError && (
              <p className="text-sm text-red-500">{fieldError}</p>
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
            <Select value={value} onValueChange={(val) => updateField(field.name, val)}>
              <SelectTrigger className={fieldError ? 'border-red-500' : ''}>
                <SelectValue placeholder={`Выберите ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError && (
              <p className="text-sm text-red-500">{fieldError}</p>
            )}
          </div>
        )

      case 'boolean':
        return (
          <div key={field.name} className="flex items-center space-x-2">
            <Switch
              id={field.name}
              checked={value}
              onCheckedChange={(checked) => updateField(field.name, checked)}
            />
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {fieldError && (
              <p className="text-sm text-red-500 ml-2">{fieldError}</p>
            )}
          </div>
        )

      case 'array':
        return (
          <div key={field.name} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {Array.isArray(value) && value.map((item: any, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={item}
                    onChange={(e) => {
                      const newArray = [...value]
                      newArray[index] = e.target.value
                      updateField(field.name, newArray)
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newArray = value.filter((_: any, i: number) => i !== index)
                      updateField(field.name, newArray)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newArray = [...(value || []), '']
                  updateField(field.name, newArray)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить элемент
              </Button>
            </div>
            {fieldError && (
              <p className="text-sm text-red-500">{fieldError}</p>
            )}
          </div>
        )

      case 'object':
        return (
          <div key={field.name} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  updateField(field.name, parsed)
                } catch {
                  // Игнорируем ошибки парсинга
                }
              }}
              placeholder="Введите JSON объект"
              className={fieldError ? 'border-red-500' : ''}
              rows={4}
            />
            {fieldError && (
              <p className="text-sm text-red-500">{fieldError}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const getModalTitle = () => {
    if (!schema) {
      return 'Редактирование'
    }
    if (isNew) {
      return `Создать ${schema.type || 'элемент'}`
    }
    return `Редактировать ${schema.type || 'элемент'}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
          <DialogDescription>
            Заполните все обязательные поля для {schema?.type || 'элемента'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {schema?.fields?.map(renderField) || (
            <div className="text-center py-8 text-muted-foreground">
              Схема не найдена для данного типа
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
