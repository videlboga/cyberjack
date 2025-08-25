import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NexusEnslaverGame from '@/app/game/page'

// Mock the config loader
jest.mock('@/lib/config-loader', () => ({
  loadGameConfig: jest.fn(() => ({
    actions: {
      categories: {
        training: {
          title: 'Обучение',
          description: 'Обучение навыкам',
          actions: {
            basic: {
              title: 'Базовое обучение',
              description: 'Базовое обучение',
              cost: 1,
              effects: { skills: { technical: 1 } }
            }
          }
        }
      }
    },
    assets: {
      assets: [
        {
          id: 'test_asset_1',
          name: 'Тестовый актив',
          rank: 'Junior',
          price: 100,
          description: 'Описание тестового актива'
        }
      ]
    },
    equipment: {
      equipment: [
        {
          id: 'test_equipment_1',
          name: 'Тестовое оборудование',
          type: 'implant',
          slot: 'ocular',
          description: 'Описание тестового оборудования'
        }
      ]
    },
    events: {
      events: [
        {
          id: 'test_event_1',
          title: 'Тестовое событие',
          description: 'Описание тестового события',
          probability: 0.5
        }
      ]
    },
    contracts: {
      available: [
        {
          id: 'test_contract_1',
          title: 'Тестовый контракт',
          description: 'Описание тестового контракта',
          client: 'Тестовый клиент',
          reward: 1000
        }
      ]
    },
    market: {
      talentExchange: [
        {
          id: 'test_market_1',
          name: 'Тестовый товар',
          price: 500,
          rank: 'Middle',
          description: 'Описание тестового товара'
        }
      ]
    },
    system: {
      attributes: [
        {
          id: 'strength',
          name: 'Сила',
          description: 'Физическая сила',
          category: 'physical'
        }
      ],
      states: [
        {
          id: 'mood',
          name: 'Настроение',
          description: 'Эмоциональное состояние',
          category: 'emotional'
        }
      ]
    }
  })),
  getEntitiesList: jest.fn((type: string) => {
    const lists = {
      actions: [
        {
          id: 'basic_training',
          title: 'Базовое обучение',
          description: 'Базовое обучение',
          cost: 1
        }
      ],
      assets: [
        {
          id: 'test_asset_1',
          name: 'Тестовый актив',
          rank: 'Junior',
          price: 100
        }
      ],
      equipment: [
        {
          id: 'test_equipment_1',
          name: 'Тестовое оборудование',
          type: 'implant',
          slot: 'ocular'
        }
      ],
      events: [
        {
          id: 'test_event_1',
          title: 'Тестовое событие',
          probability: 0.5
        }
      ],
      contracts: [
        {
          id: 'test_contract_1',
          title: 'Тестовый контракт',
          client: 'Тестовый клиент',
          reward: 1000
        }
      ],
      market: [
        {
          id: 'test_market_1',
          name: 'Тестовый товар',
          price: 500,
          rank: 'Middle'
        }
      ],
      system: [
        {
          id: 'strength',
          name: 'Сила',
          category: 'physical'
        },
        {
          id: 'mood',
          name: 'Настроение',
          category: 'emotional'
        }
      ]
    }
    return lists[type] || []
  })
}))

// Mock the EnhancedEditModal
jest.mock('@/app/game/components/ui/EnhancedEditModal', () => {
  return function MockEnhancedEditModal({ isOpen, onClose, onSave, entityType, isNew }: any) {
    if (!isOpen) return null
    
    return (
      <div data-testid="enhanced-edit-modal">
        <h2>{isNew ? 'Создать' : 'Редактировать'} {entityType}</h2>
        <button onClick={() => onSave({ id: 'test_id', name: 'test_name' })}>Сохранить</button>
        <button onClick={onClose}>Отмена</button>
      </div>
    )
  }
})

// Mock the EntityList component
jest.mock('@/app/game/components/ui/EntityList', () => {
  return function MockEntityList({ entities, onEdit, onDelete, onAdd, title }: any) {
    return (
      <div data-testid="entity-list">
        <h3>{title}</h3>
        <button onClick={onAdd}>Добавить</button>
        {entities.map((entity: any) => (
          <div key={entity.id} data-testid={`entity-${entity.id}`}>
            <span>{entity.name || entity.title}</span>
            <button onClick={() => onEdit(entity)}>Редактировать</button>
            <button onClick={() => onDelete(entity.id)}>Удалить</button>
          </div>
        ))}
      </div>
    )
  }
})

describe('NexusEnslaverGame', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Рендеринг', () => {
    it('должен отображать заголовок приложения', () => {
      render(<NexusEnslaverGame />)
      expect(screen.getByText('Nexus Enslaver')).toBeInTheDocument()
    })

    it('должен отображать подзаголовок', () => {
      render(<NexusEnslaverGame />)
      expect(screen.getByText('Development Panel')).toBeInTheDocument()
    })

    it('должен отображать все основные табы', () => {
      render(<NexusEnslaverGame />)
      
      expect(screen.getByText('Активы')).toBeInTheDocument()
      expect(screen.getByText('Действия')).toBeInTheDocument()
      expect(screen.getByText('Оборудование')).toBeInTheDocument()
      expect(screen.getByText('События')).toBeInTheDocument()
      expect(screen.getByText('Контракты')).toBeInTheDocument()
      expect(screen.getByText('Рынок')).toBeInTheDocument()
      expect(screen.getByText('Системы')).toBeInTheDocument()
    })

    it('должен отображать статистику конфигураций', () => {
      render(<NexusEnslaverGame />)
      
      // Проверяем, что отображается статистика
      expect(screen.getByText(/actions:/)).toBeInTheDocument()
      expect(screen.getByText(/assets:/)).toBeInTheDocument()
      expect(screen.getByText(/equipment:/)).toBeInTheDocument()
    })
  })

  describe('Навигация по табам', () => {
    it('должен переключаться между табами', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // Проверяем, что активен первый таб (Активы)
      expect(screen.getByText('Активы')).toHaveAttribute('data-state', 'active')
      
      // Переключаемся на таб Действия
      const actionsTab = screen.getByText('Действия')
      await user.click(actionsTab)
      
      expect(actionsTab).toHaveAttribute('data-state', 'active')
    })

    it('должен отображать содержимое каждого таба', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // Проверяем содержимое таба Активы
      expect(screen.getByTestId('entity-list')).toBeInTheDocument()
      
      // Переключаемся на таб Действия
      const actionsTab = screen.getByText('Действия')
      await user.click(actionsTab)
      
      // Проверяем, что отображается список действий
      expect(screen.getByTestId('entity-list')).toBeInTheDocument()
    })
  })

  describe('Работа с сущностями', () => {
    it('должен отображать список активов', () => {
      render(<NexusEnslaverGame />)
      
      expect(screen.getByTestId('entity-test_asset_1')).toBeInTheDocument()
      expect(screen.getByText('Тестовый актив')).toBeInTheDocument()
    })

    it('должен отображать список действий', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const actionsTab = screen.getByText('Действия')
      await user.click(actionsTab)
      
      expect(screen.getByTestId('entity-basic_training')).toBeInTheDocument()
      expect(screen.getByText('Базовое обучение')).toBeInTheDocument()
    })

    it('должен отображать список оборудования', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const equipmentTab = screen.getByText('Оборудование')
      await user.click(equipmentTab)
      
      expect(screen.getByTestId('entity-test_equipment_1')).toBeInTheDocument()
      expect(screen.getByText('Тестовое оборудование')).toBeInTheDocument()
    })
  })

  describe('Модальное окно редактирования', () => {
    it('должен открывать модалку при нажатии кнопки добавления', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      expect(screen.getByTestId('enhanced-edit-modal')).toBeInTheDocument()
      expect(screen.getByText('Создать assets')).toBeInTheDocument()
    })

    it('должен открывать модалку при редактировании сущности', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const editButton = screen.getByText('Редактировать')
      await user.click(editButton)
      
      expect(screen.getByTestId('enhanced-edit-modal')).toBeInTheDocument()
      expect(screen.getByText('Редактировать assets')).toBeInTheDocument()
    })

    it('должен закрывать модалку при нажатии кнопки отмены', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // Открываем модалку
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      expect(screen.getByTestId('enhanced-edit-modal')).toBeInTheDocument()
      
      // Закрываем модалку
      const cancelButton = screen.getByText('Отмена')
      await user.click(cancelButton)
      
      expect(screen.queryByTestId('enhanced-edit-modal')).not.toBeInTheDocument()
    })

    it('должен сохранять данные при нажатии кнопки сохранения', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // Открываем модалку
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      // Сохраняем данные
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      // Модалка должна закрыться
      expect(screen.queryByTestId('enhanced-edit-modal')).not.toBeInTheDocument()
    })
  })

  describe('Удаление сущностей', () => {
    it('должен отображать кнопку удаления для каждой сущности', () => {
      render(<NexusEnslaverGame />)
      
      const deleteButtons = screen.getAllByText('Удалить')
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('должен вызывать функцию удаления при нажатии кнопки удаления', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const deleteButton = screen.getByText('Удалить')
      await user.click(deleteButton)
      
      // Здесь можно добавить проверку вызова функции удаления
      // если она будет реализована в компоненте
    })
  })

  describe('Группировка и фильтрация', () => {
    it('должен группировать оборудование по категориям', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const equipmentTab = screen.getByText('Оборудование')
      await user.click(equipmentTab)
      
      // Проверяем, что отображаются группы оборудования
      expect(screen.getByText('Импланты')).toBeInTheDocument()
      expect(screen.getByText('Одежда')).toBeInTheDocument()
      expect(screen.getByText('Устройства')).toBeInTheDocument()
    })

    it('должен группировать атрибуты по категориям', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const systemsTab = screen.getByText('Системы')
      await user.click(systemsTab)
      
      // Проверяем, что отображаются группы атрибутов
      expect(screen.getByText('Атрибуты')).toBeInTheDocument()
      expect(screen.getByText('Состояния')).toBeInTheDocument()
      expect(screen.getByText('Навыки')).toBeInTheDocument()
    })
  })

  describe('Темная тема', () => {
    it('должен отображать кнопку переключения темы', () => {
      render(<NexusEnslaverGame />)
      
      // Проверяем, что есть кнопка переключения темы
      // (может быть иконка солнца или луны)
      const themeButton = screen.getByRole('button', { name: /theme/i })
      expect(themeButton).toBeInTheDocument()
    })

    it('должен переключать тему при нажатии кнопки', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      const themeButton = screen.getByRole('button', { name: /theme/i })
      await user.click(themeButton)
      
      // Проверяем, что класс dark добавлен к корневому элементу
      expect(document.documentElement).toHaveClass('dark')
    })
  })

  describe('Синхронизация', () => {
    it('должен отображать статус синхронизации', () => {
      render(<NexusEnslaverGame />)
      
      // Проверяем, что отображается компонент статуса синхронизации
      expect(screen.getByTestId('sync-status')).toBeInTheDocument()
    })
  })

  describe('Обработка ошибок', () => {
    it('должен отображать сообщение об ошибке при проблемах с загрузкой данных', () => {
      // Здесь можно добавить тест для обработки ошибок загрузки
      // когда будет реализована обработка ошибок
    })

    it('должен отображать сообщение при отсутствии данных', () => {
      // Здесь можно добавить тест для отображения пустого состояния
      // когда будет реализовано отображение пустых состояний
    })
  })
})

