import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnhancedEditModal } from '@/app/game/components/ui/EnhancedEditModal'

// Mock the field configs
jest.mock('@/lib/field-configs', () => ({
  getFieldConfig: jest.fn((entityType: string) => {
    const configs = {
      assets: [
        { name: 'id', type: 'text', label: 'ID', required: true },
        { name: 'name', type: 'text', label: 'Имя', required: true },
        { name: 'description', type: 'textarea', label: 'Описание', required: false },
        { name: 'rank', type: 'select', label: 'Ранг', options: ['Junior', 'Middle', 'Senior'], required: true },
        { name: 'price', type: 'number', label: 'Цена', required: true, min: 0, max: 10000 },
        { 
          name: 'attributes', 
          type: 'dynamic-object', 
          label: 'Атрибуты', 
          required: false,
          dynamicConfig: {
            type: 'attributes',
            options: ['strength', 'empathy', 'intelligence'],
            min: 1,
            max: 10
          }
        },
        { 
          name: 'traits', 
          type: 'dynamic-array', 
          label: 'Черты характера', 
          required: false,
          dynamicConfig: {
            type: 'preferences',
            options: ['loyal', 'quick_learner', 'tech_savvy']
          }
        }
      ],
      actions: [
        { name: 'title', type: 'text', label: 'Название', required: true },
        { name: 'description', type: 'textarea', label: 'Описание', required: true },
        { name: 'cost', type: 'number', label: 'Стоимость', required: true, min: 0, max: 1000 },
        { 
          name: 'effects', 
          type: 'dynamic-object', 
          label: 'Эффекты', 
          required: false,
          dynamicConfig: {
            type: 'effects',
            options: ['skills', 'states'],
            subType: 'skills'
          }
        }
      ]
    }
    return configs[entityType] || [
      { name: 'id', type: 'text', label: 'ID', required: true },
      { name: 'name', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: false }
    ]
  }),
  getEntityDisplayName: jest.fn((entityType: string) => {
    const names = {
      assets: 'актив',
      actions: 'действие',
      equipment: 'оборудование'
    }
    return names[entityType] || entityType
  })
}))

describe('EnhancedEditModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    entityType: 'assets',
    isNew: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Рендеринг', () => {
    it('должен отображать заголовок для создания новой сущности', () => {
      render(<EnhancedEditModal {...defaultProps} isNew={true} />)
      expect(screen.getByText('Создать актив')).toBeInTheDocument()
    })

    it('должен отображать заголовок для редактирования сущности', () => {
      render(<EnhancedEditModal {...defaultProps} isNew={false} />)
      expect(screen.getByText('Редактировать актив')).toBeInTheDocument()
    })

    it('должен отображать все обязательные поля для активов', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      expect(screen.getByLabelText('ID *')).toBeInTheDocument()
      expect(screen.getByLabelText('Имя *')).toBeInTheDocument()
      expect(screen.getByLabelText('Ранг *')).toBeInTheDocument()
      expect(screen.getByLabelText('Цена *')).toBeInTheDocument()
    })

    it('должен отображать необязательные поля', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      expect(screen.getByLabelText('Описание')).toBeInTheDocument()
    })

    it('должен отображать вкладки для сложных форм', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      expect(screen.getByText('Основные поля')).toBeInTheDocument()
      expect(screen.getByText('Дополнительные поля')).toBeInTheDocument()
    })
  })

  describe('Взаимодействие с полями', () => {
    it('должен обновлять значения текстовых полей', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText('Имя *')
      await user.type(nameInput, 'Тестовый актив')
      
      expect(nameInput).toHaveValue('Тестовый актив')
    })

    it('должен обновлять значения числовых полей', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const priceInput = screen.getByLabelText('Цена *')
      await user.type(priceInput, '1500')
      
      expect(priceInput).toHaveValue(1500)
    })

    it('должен обновлять значения select полей', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const rankSelect = screen.getByLabelText('Ранг *')
      await user.click(rankSelect)
      
      const middleOption = screen.getByText('Middle')
      await user.click(middleOption)
      
      expect(rankSelect).toHaveValue('Middle')
    })

    it('должен обновлять значения textarea полей', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const descriptionTextarea = screen.getByLabelText('Описание')
      await user.type(descriptionTextarea, 'Описание тестового актива')
      
      expect(descriptionTextarea).toHaveValue('Описание тестового актива')
    })
  })

  describe('Динамические объекты', () => {
    it('должен отображать кнопку добавления для динамических объектов', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Переключаемся на вкладку дополнительных полей
      const advancedTab = screen.getByText('Дополнительные поля')
      fireEvent.click(advancedTab)
      
      expect(screen.getByText('Добавить')).toBeInTheDocument()
    })

    it('должен добавлять новые ключи в динамические объекты', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Переключаемся на вкладку дополнительных полей
      const advancedTab = screen.getByText('Дополнительные поля')
      await user.click(advancedTab)
      
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      // Проверяем, что появился select для выбора ключа
      expect(screen.getByDisplayValue('strength')).toBeInTheDocument()
    })
  })

  describe('Динамические массивы', () => {
    it('должен отображать кнопку добавления для динамических массивов', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Переключаемся на вкладку дополнительных полей
      const advancedTab = screen.getByText('Дополнительные поля')
      fireEvent.click(advancedTab)
      
      // Ищем кнопки добавления для массивов
      const addButtons = screen.getAllByText('Добавить')
      expect(addButtons.length).toBeGreaterThan(0)
    })

    it('должен добавлять новые элементы в динамические массивы', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Переключаемся на вкладку дополнительных полей
      const advancedTab = screen.getByText('Дополнительные поля')
      await user.click(advancedTab)
      
      const addButtons = screen.getAllByText('Добавить')
      await user.click(addButtons[1]) // Вторая кнопка для массива
      
      // Проверяем, что появился select для выбора элемента
      expect(screen.getByDisplayValue('loyal')).toBeInTheDocument()
    })
  })

  describe('Валидация', () => {
    it('должен показывать обязательные поля как обязательные', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      const requiredFields = screen.getAllByText('*')
      expect(requiredFields.length).toBeGreaterThan(0)
    })

    it('должен валидировать числовые диапазоны', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const priceInput = screen.getByLabelText('Цена *')
      await user.type(priceInput, '15000') // Превышает максимум
      
      expect(priceInput).toHaveAttribute('max', '10000')
    })
  })

  describe('Сохранение', () => {
    it('должен вызывать onSave с правильными данными', async () => {
      const user = userEvent.setup()
      const onSave = jest.fn()
      render(<EnhancedEditModal {...defaultProps} onSave={onSave} />)
      
      // Заполняем обязательные поля
      const idInput = screen.getByLabelText('ID *')
      const nameInput = screen.getByLabelText('Имя *')
      const rankSelect = screen.getByLabelText('Ранг *')
      const priceInput = screen.getByLabelText('Цена *')
      
      await user.type(idInput, 'test_asset_1')
      await user.type(nameInput, 'Тестовый актив')
      await user.click(rankSelect)
      await user.click(screen.getByText('Middle'))
      await user.type(priceInput, '1500')
      
      // Нажимаем кнопку сохранения
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      expect(onSave).toHaveBeenCalledWith({
        id: 'test_asset_1',
        name: 'Тестовый актив',
        rank: 'Middle',
        price: 1500,
        description: ''
      })
    })

    it('должен закрывать модалку после сохранения', async () => {
      const user = userEvent.setup()
      const onClose = jest.fn()
      render(<EnhancedEditModal {...defaultProps} onClose={onClose} />)
      
      // Заполняем минимальные данные
      const idInput = screen.getByLabelText('ID *')
      const nameInput = screen.getByLabelText('Имя *')
      const rankSelect = screen.getByLabelText('Ранг *')
      const priceInput = screen.getByLabelText('Цена *')
      
      await user.type(idInput, 'test_asset_1')
      await user.type(nameInput, 'Тестовый актив')
      await user.click(rankSelect)
      await user.click(screen.getByText('Middle'))
      await user.type(priceInput, '1500')
      
      // Нажимаем кнопку сохранения
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Отмена', () => {
    it('должен вызывать onClose при нажатии кнопки отмены', async () => {
      const user = userEvent.setup()
      const onClose = jest.fn()
      render(<EnhancedEditModal {...defaultProps} onClose={onClose} />)
      
      const cancelButton = screen.getByText('Отмена')
      await user.click(cancelButton)
      
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Разные типы сущностей', () => {
    it('должен отображать правильные поля для действий', () => {
      render(<EnhancedEditModal {...defaultProps} entityType="actions" />)
      
      expect(screen.getByLabelText('Название *')).toBeInTheDocument()
      expect(screen.getByLabelText('Описание *')).toBeInTheDocument()
      expect(screen.getByLabelText('Стоимость *')).toBeInTheDocument()
    })

    it('должен отображать правильные поля для оборудования', () => {
      render(<EnhancedEditModal {...defaultProps} entityType="equipment" />)
      
      expect(screen.getByLabelText('ID *')).toBeInTheDocument()
      expect(screen.getByLabelText('Название *')).toBeInTheDocument()
      expect(screen.getByLabelText('Тип *')).toBeInTheDocument()
    })
  })

  describe('Инициализация данных', () => {
    it('должен заполнять поля начальными данными', () => {
      const initialData = {
        id: 'existing_asset',
        name: 'Существующий актив',
        rank: 'Senior',
        price: 2500,
        description: 'Описание существующего актива'
      }
      
      render(<EnhancedEditModal {...defaultProps} initialData={initialData} />)
      
      expect(screen.getByDisplayValue('existing_asset')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Существующий актив')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Senior')).toBeInTheDocument()
      expect(screen.getByDisplayValue(2500)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Описание существующего актива')).toBeInTheDocument()
    })
  })
})

