import { useState, useCallback } from 'react'

export interface EntityField {
  name: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'array' | 'object' | 'boolean'
  label: string
  required?: boolean
  options?: string[]
  validation?: (value: any) => string | null
}

export interface EntitySchema {
  type: string
  fields: EntityField[]
  defaultValues: Record<string, any>
}

export const useEntityEditor = () => {
  const [editingItem, setEditingItem] = useState<any>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateField = useCallback((field: EntityField, value: any): string | null => {
    // Проверка обязательности
    if (field.required && (!value || value === '')) {
      return `${field.label} обязательно для заполнения`
    }

    // Проверка типа
    if (value !== null && value !== undefined) {
      switch (field.type) {
        case 'number':
          if (isNaN(Number(value))) {
            return `${field.label} должно быть числом`
          }
          break
        case 'array':
          if (!Array.isArray(value)) {
            return `${field.label} должно быть массивом`
          }
          break
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            return `${field.label} должно быть объектом`
          }
          break
        case 'boolean':
          if (typeof value !== 'boolean') {
            return `${field.label} должно быть логическим значением`
          }
          break
      }
    }

    // Кастомная валидация
    if (field.validation) {
      return field.validation(value)
    }

    return null
  }, [])

  const validateItem = useCallback((item: any, schema: EntitySchema): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    schema.fields.forEach(field => {
      const error = validateField(field, item[field.name])
      if (error) {
        newErrors[field.name] = error
      }
    })

    return newErrors
  }, [validateField])

  const updateField = useCallback((fieldName: string, value: any) => {
    setEditingItem(prev => ({
      ...prev,
      [fieldName]: value
    }))

    // Очищаем ошибку для этого поля
    setErrors(prev => ({
      ...prev,
      [fieldName]: ''
    }))
  }, [])

  const startEditing = useCallback((item: any, schema: EntitySchema) => {
    const itemWithDefaults = {
      ...schema.defaultValues,
      ...item
    }
    setEditingItem(itemWithDefaults)
    setErrors({})
  }, [])

  const saveItem = useCallback((schema: EntitySchema): { success: boolean; errors?: Record<string, string> } => {
    if (!editingItem) {
      return { success: false, errors: { general: 'Нет данных для сохранения' } }
    }

    const validationErrors = validateItem(editingItem, schema)
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return { success: false, errors: validationErrors }
    }

    return { success: true }
  }, [editingItem, validateItem])

  const cancelEditing = useCallback(() => {
    setEditingItem(null)
    setErrors({})
  }, [])

  const getFieldError = useCallback((fieldName: string): string => {
    return errors[fieldName] || ''
  }, [errors])

  const hasErrors = useCallback((): boolean => {
    return Object.keys(errors).some(key => errors[key] !== '')
  }, [errors])

  return {
    editingItem,
    errors,
    updateField,
    startEditing,
    saveItem,
    cancelEditing,
    getFieldError,
    hasErrors,
    validateField,
    validateItem
  }
}

