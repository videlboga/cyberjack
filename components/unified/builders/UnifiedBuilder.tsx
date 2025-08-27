"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Edit, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Code
} from 'lucide-react'
import { BuilderProps, BuilderField, ValidationResult } from '../types'

interface UnifiedBuilderProps extends BuilderProps {
  // Дополнительные пропсы для унифицированного построителя
  title?: string
  subtitle?: string
  showPreview?: boolean
  showCode?: boolean
  showValidation?: boolean
  maxFields?: number
  allowReorder?: boolean
  onSave?: (data: Record<string, any>) => void
  onPreview?: (data: Record<string, any>) => void
}

export function UnifiedBuilder({
  fields,
  data,
  onDataChange,
  onValidationChange,
  mode = 'edit',
  title = "Построитель",
  subtitle,
  showPreview = false,
  showCode = false,
  showValidation = true,
  maxFields,
  allowReorder = false,
  onSave,
  onPreview,
  className,
  disabled = false,
  loading = false,
  error,
  ...props
}: UnifiedBuilderProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isCodeMode, setIsCodeMode] = useState(false)

  // Валидация данных
  useEffect(() => {
    const errors: Record<string, string> = {}
    
    fields.forEach(field => {
      if (field.required && (!data[field.name] || data[field.name] === '')) {
        errors[field.name] = `${field.label} обязательно для заполнения`
      }
      
      if (field.validation) {
        const value = data[field.name]
        
        if (field.validation.min !== undefined && value < field.validation.min) {
          errors[field.name] = `Минимальное значение: ${field.validation.min}`
        }
        
        if (field.validation.max !== undefined && value > field.validation.max) {
          errors[field.name] = `Максимальное значение: ${field.validation.max}`
        }
        
        if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
          errors[field.name] = `Неверный формат`
        }
        
        if (field.validation.custom && !field.validation.custom(value)) {
          errors[field.name] = `Неверное значение`
        }
      }
    })
    
    setValidationErrors(errors)
    
    const isValid = Object.keys(errors).length === 0
    onValidationChange?.(isValid, Object.values(errors))
  }, [data, fields, onValidationChange])

  // Обработка изменения поля
  const handleFieldChange = (fieldName: string, value: any) => {
    onDataChange({
      ...data,
      [fieldName]: value
    })
  }

  // Рендер поля ввода
  const renderField = (field: BuilderField) => {
    const fieldValue = data[field.name]
    const fieldError = validationErrors[field.name]
    const isFieldDisabled = disabled || mode === 'view'

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              value={fieldValue || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.description}
              disabled={isFieldDisabled}
              className={fieldError ? 'border-red-500' : ''}
            />
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={fieldValue || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.description}
              disabled={isFieldDisabled}
              className={fieldError ? 'border-red-500' : ''}
              rows={4}
            />
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="number"
              value={fieldValue || ''}
              onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value) || 0)}
              placeholder={field.description}
              disabled={isFieldDisabled}
              className={fieldError ? 'border-red-500' : ''}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.validation?.step}
            />
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'boolean':
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={fieldValue || false}
                onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
                disabled={isFieldDisabled}
              />
              <Label htmlFor={field.id} className="flex items-center">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={fieldValue || ''}
              onValueChange={(value) => handleFieldChange(field.name, value)}
              disabled={isFieldDisabled}
            >
              <SelectTrigger className={fieldError ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.description} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'array':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {(fieldValue || []).map((item: any, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={item}
                    onChange={(e) => {
                      const newArray = [...(fieldValue || [])]
                      newArray[index] = e.target.value
                      handleFieldChange(field.name, newArray)
                    }}
                    placeholder={`Элемент ${index + 1}`}
                    disabled={isFieldDisabled}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newArray = (fieldValue || []).filter((_: any, i: number) => i !== index)
                      handleFieldChange(field.name, newArray)
                    }}
                    disabled={isFieldDisabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newArray = [...(fieldValue || []), '']
                  handleFieldChange(field.name, newArray)
                }}
                disabled={isFieldDisabled}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить элемент
              </Button>
            </div>
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )

      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              value={fieldValue || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.description}
              disabled={isFieldDisabled}
              className={fieldError ? 'border-red-500' : ''}
            />
            {fieldError && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {fieldError}
              </p>
            )}
            {field.description && !fieldError && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
          </div>
        )
    }
  }

  // Рендер предварительного просмотра
  const renderPreview = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Предварительный просмотр</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(field => (
          <div key={field.id} className="p-3 border rounded">
            <div className="font-medium text-sm text-gray-600">{field.label}</div>
            <div className="mt-1">
              {Array.isArray(data[field.name]) ? (
                <div className="flex flex-wrap gap-1">
                  {data[field.name]?.map((item: any, index: number) => (
                    <Badge key={index} variant="secondary">{item}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm">{data[field.name] || 'Не указано'}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Рендер кода
  const renderCode = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">JSON код</h3>
      <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    </div>
  )

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>{title}</span>
            {subtitle && (
              <span className="text-sm font-normal text-gray-500">- {subtitle}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {showPreview && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {isPreviewMode ? 'Скрыть' : 'Предварительный просмотр'}
              </Button>
            )}
            
            {showCode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCodeMode(!isCodeMode)}
              >
                <Code className="h-4 w-4 mr-1" />
                {isCodeMode ? 'Скрыть код' : 'Показать код'}
              </Button>
            )}
            
            {onSave && (
              <Button
                size="sm"
                onClick={() => onSave(data)}
                disabled={disabled || loading || Object.keys(validationErrors).length > 0}
              >
                <Save className="h-4 w-4 mr-1" />
                Сохранить
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {loading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-600">Загрузка...</p>
          </div>
        )}
        
        {isPreviewMode ? (
          renderPreview()
        ) : isCodeMode ? (
          renderCode()
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-6">
              {fields.map(renderField)}
              
              {showValidation && Object.keys(validationErrors).length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <h4 className="font-medium text-yellow-800 mb-2">Ошибки валидации:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {Object.values(validationErrors).map((error, index) => (
                      <li key={index} className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

export default UnifiedBuilder
