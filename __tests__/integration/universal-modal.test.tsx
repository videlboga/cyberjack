import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnhancedEditModal } from '@/app/game/components/ui/EnhancedEditModal'
import { getFieldConfig } from '@/lib/field-configs'

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
      ],
      equipment: [
        { name: 'id', type: 'text', label: 'ID', required: true },
        { name: 'name', type: 'text', label: 'Название', required: true },
        { name: 'type', type: 'select', label: 'Тип', options: ['implant', 'clothing', 'device'], required: true },
        { name: 'slot', type: 'select', label: 'Слот', options: ['ocular', 'body', 'head', 'neural'], required: true },
        { name: 'removable', type: 'switch', label: 'Съемное', required: false },
        { 
          name: 'effects', 
          type: 'dynamic-object', 
          label: 'Эффекты', 
          required: false,
          dynamicConfig: {
            type: 'effects',
            options: ['attributes', 'skills', 'states']
          }
        },
        { 
          name: 'modes', 
          type: 'dynamic-array', 
          label: 'Режимы работы', 
          required: false,
          dynamicConfig: {
            type: 'preferences',
            options: ['normal', 'boost', 'stealth']
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

describe('Universal Modal Integration', () => {
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

  describe('Интеграция с системой конфигурации полей', () => {
    it('должен загружать конфигурацию полей для активов', () => {
      render(<EnhancedEditModal {...defaultProps} entityType="assets" />)
      
      expect(getFieldConfig).toHaveBeenCalledWith('assets')
      expect(screen.getByLabelText('ID *')).toBeInTheDocument()
      expect(screen.getByLabelText('Имя *')).toBeInTheDocument()
      expect(screen.getByLabelText('Ранг *')).toBeInTheDocument()
      expect(screen.getByLabelText('Цена *')).toBeInTheDocument()
    })

    it('должен загружать конфигурацию полей для действий', () => {
      render(<EnhancedEditModal {...defaultProps} entityType="actions" />)
      
      expect(getFieldConfig).toHaveBeenCalledWith('actions')
      expect(screen.getByLabelText('Название *')).toBeInTheDocument()
      expect(screen.getByLabelText('Описание *')).toBeInTheDocument()
      expect(screen.getByLabelText('Стоимость *')).toBeInTheDocument()
    })

    it('должен загружать конфигурацию полей для оборудования', () => {
      render(<EnhancedEditModal {...defaultProps} entityType="equipment" />)
      
      expect(getFieldConfig).toHaveBeenCalledWith('equipment')
      expect(screen.getByLabelText('ID *')).toBeInTheDocument()
      expect(screen.getByLabelText('Название *')).toBeInTheDocument()
      expect(screen.getByLabelText('Тип *')).toBeInTheDocument()
      expect(screen.getByLabelText('Слот *')).toBeInTheDocument()
    })
  })

  describe('Интеграция с динамическими полями', () => {
    it('должен корректно обрабатывать динамические объекты', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} entityType="assets" />)
      
      // Переключаемся на вкладку дополнительных полей
      const advancedTab = screen.getByText('Дополнительные поля')
      await user.click(advancedTab)
      
      // Добавляем атрибут
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      // Выбираем атрибут
      const attributeSelect = screen.getByDisplayValue('strength')
      await user.click(attributeSelect)
      
      // Устанавливаем значение
      const valueInput = screen.getByDisplayValue('1')
      await user.clear(valueInput)
      await user.type(valueInput, '5')
      
      // Проверяем, что значение установлено
      expect(valueInput).toHaveValue(5)
    })

    it('должен корректно обрабатывать динамические массивы', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} entityType="assets" />)
      
      // Переключаемся на вкладку дополнительных полей
      const advancedTab = screen.getByText('Дополнительные поля')
      await user.click(advancedTab)
      
      // Добавляем черту характера
      const addButtons = screen.getAllByText('Добавить')
      await user.click(addButtons[1]) // Вторая кнопка для массива
      
      // Выбираем черту
      const traitSelect = screen.getByDisplayValue('loyal')
      await user.click(traitSelect)
      
      // Проверяем, что черта добавлена
      expect(screen.getByDisplayValue('loyal')).toBeInTheDocument()
    })
  })

  describe('Интеграция с валидацией', () => {
    it('должен валидировать обязательные поля', async () => {
      const user = userEvent.setup()
      const onSave = jest.fn()
      render(<EnhancedEditModal {...defaultProps} onSave={onSave} />)
      
      // Пытаемся сохранить без заполнения обязательных полей
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      // Проверяем, что onSave не вызывается
      expect(onSave).not.toHaveBeenCalled()
    })

    it('должен валидировать числовые диапазоны', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const priceInput = screen.getByLabelText('Цена *')
      await user.type(priceInput, '15000') // Превышает максимум
      
      // Проверяем, что поле имеет ограничение
      expect(priceInput).toHaveAttribute('max', '10000')
    })

    it('должен валидировать select поля', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const rankSelect = screen.getByLabelText('Ранг *')
      await user.click(rankSelect)
      
      // Проверяем, что отображаются только допустимые опции
      expect(screen.getByText('Junior')).toBeInTheDocument()
      expect(screen.getByText('Middle')).toBeInTheDocument()
      expect(screen.getByText('Senior')).toBeInTheDocument()
    })
  })

  describe('Интеграция с состоянием формы', () => {
    it('должен инициализировать форму с начальными данными', () => {
      const initialData = {
        id: 'existing_asset',
        name: 'Существующий актив',
        rank: 'Senior',
        price: 2500,
        description: 'Описание существующего актива',
        attributes: {
          strength: 7,
          empathy: 4
        },
        traits: ['loyal', 'quick_learner']
      }
      
      render(<EnhancedEditModal {...defaultProps} initialData={initialData} />)
      
      expect(screen.getByDisplayValue('existing_asset')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Существующий актив')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Senior')).toBeInTheDocument()
      expect(screen.getByDisplayValue(2500)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Описание существующего актива')).toBeInTheDocument()
    })

    it('должен обновлять состояние при изменении полей', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText('Имя *')
      await user.type(nameInput, 'Новый актив')
      
      expect(nameInput).toHaveValue('Новый актив')
    })

    it('должен сохранять состояние при переключении вкладок', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Заполняем основное поле
      const nameInput = screen.getByLabelText('Имя *')
      await user.type(nameInput, 'Тестовый актив')
      
      // Переключаемся на дополнительную вкладку
      const advancedTab = screen.getByText('Дополнительные поля')
      await user.click(advancedTab)
      
      // Возвращаемся на основную вкладку
      const basicTab = screen.getByText('Основные поля')
      await user.click(basicTab)
      
      // Проверяем, что данные сохранились
      expect(nameInput).toHaveValue('Тестовый актив')
    })
  })

  describe('Интеграция с обработчиками событий', () => {
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

    it('должен вызывать onClose при отмене', async () => {
      const user = userEvent.setup()
      const onClose = jest.fn()
      render(<EnhancedEditModal {...defaultProps} onClose={onClose} />)
      
      const cancelButton = screen.getByText('Отмена')
      await user.click(cancelButton)
      
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Интеграция с разными типами сущностей', () => {
    it('должен корректно обрабатывать переключение между типами', () => {
      const { rerender } = render(<EnhancedEditModal {...defaultProps} entityType="assets" />)
      
      expect(screen.getByLabelText('ID *')).toBeInTheDocument()
      expect(screen.getByLabelText('Имя *')).toBeInTheDocument()
      expect(screen.getByLabelText('Ранг *')).toBeInTheDocument()
      
      // Переключаемся на действия
      rerender(<EnhancedEditModal {...defaultProps} entityType="actions" />)
      
      expect(screen.getByLabelText('Название *')).toBeInTheDocument()
      expect(screen.getByLabelText('Описание *')).toBeInTheDocument()
      expect(screen.getByLabelText('Стоимость *')).toBeInTheDocument()
      
      // Переключаемся на оборудование
      rerender(<EnhancedEditModal {...defaultProps} entityType="equipment" />)
      
      expect(screen.getByLabelText('ID *')).toBeInTheDocument()
      expect(screen.getByLabelText('Название *')).toBeInTheDocument()
      expect(screen.getByLabelText('Тип *')).toBeInTheDocument()
      expect(screen.getByLabelText('Слот *')).toBeInTheDocument()
    })

    it('должен очищать форму при смене типа сущности', () => {
      const { rerender } = render(<EnhancedEditModal {...defaultProps} entityType="assets" />)
      
      // Переключаемся на другой тип
      rerender(<EnhancedEditModal {...defaultProps} entityType="actions" />)
      
      // Проверяем, что поля очищены
      const titleInput = screen.getByLabelText('Название *')
      expect(titleInput).toHaveValue('')
    })
  })

  describe('Интеграция с доступностью', () => {
    it('должен иметь правильные ARIA атрибуты', () => {
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Проверяем, что модалка имеет правильную роль
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      
      // Проверяем, что поля имеют правильные лейблы
      const idInput = screen.getByLabelText('ID *')
      expect(idInput).toHaveAttribute('aria-required', 'true')
    })

    it('должен поддерживать навигацию с клавиатуры', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      // Фокусируемся на первом поле
      const idInput = screen.getByLabelText('ID *')
      idInput.focus()
      
      // Переходим к следующему полю с Tab
      await user.tab()
      
      // Проверяем, что фокус перешел на следующее поле
      const nameInput = screen.getByLabelText('Имя *')
      expect(nameInput).toHaveFocus()
    })
  })

  describe('Интеграция с производительностью', () => {
    it('должен эффективно обрабатывать большие формы', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} entityType="equipment" />)
      
      // Переключаемся на дополнительную вкладку
      const advancedTab = screen.getByText('Дополнительные поля')
      await user.click(advancedTab)
      
      // Добавляем несколько эффектов
      const addButtons = screen.getAllByText('Добавить')
      for (let i = 0; i < 3; i++) {
        await user.click(addButtons[0])
      }
      
      // Проверяем, что форма остается отзывчивой
      expect(screen.getAllByText('Добавить').length).toBeGreaterThan(0)
    })

    it('должен оптимизировать рендеринг при изменении полей', async () => {
      const user = userEvent.setup()
      render(<EnhancedEditModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText('Имя *')
      
      // Быстро вводим текст
      await user.type(nameInput, 'Очень длинное название актива для тестирования производительности')
      
      // Проверяем, что ввод работает корректно
      expect(nameInput).toHaveValue('Очень длинное название актива для тестирования производительности')
    })
  })
})

