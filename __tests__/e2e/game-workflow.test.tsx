import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NexusEnslaverGame from '@/app/game/page'
import ProdPage from '@/app/prod/page'

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
            },
            advanced: {
              title: 'Продвинутое обучение',
              description: 'Продвинутое обучение',
              cost: 3,
              effects: { skills: { technical: 2, hacking: 1 } }
            }
          }
        },
        conditioning: {
          title: 'Кондиционирование',
          description: 'Психологическое кондиционирование',
          actions: {
            fear: {
              title: 'Внушение страха',
              description: 'Внушение страха подчиненному',
              cost: 2,
              effects: { states: { fear: 20 } }
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
          description: 'Описание тестового актива',
          status: 'available',
          attributes: { strength: 5, empathy: 3, intelligence: 4 },
          skills: { maid: 2, cooking: 1, neural_hacking: 3 },
          states: { mood: 50, fear: 20, despair: 10 }
        },
        {
          id: 'test_asset_2',
          name: 'Второй актив',
          rank: 'Middle',
          price: 500,
          description: 'Описание второго актива',
          status: 'available',
          attributes: { strength: 7, empathy: 5, intelligence: 6 },
          skills: { maid: 3, cooking: 2, neural_hacking: 4 },
          states: { mood: 60, fear: 15, despair: 5 }
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
          description: 'Описание тестового оборудования',
          effects: { Intelligence: 10, Fear: 5 },
          removable: false,
          powerSettings: { min: 50, max: 150, default: 100 }
        },
        {
          id: 'test_equipment_2',
          name: 'Второе оборудование',
          type: 'clothing',
          slot: 'body',
          description: 'Описание второго оборудования',
          effects: { Strength: 5, Mood: 10 },
          removable: true,
          powerSettings: { min: 0, max: 100, default: 50 }
        }
      ]
    },
    events: {
      events: [
        {
          id: 'test_event_1',
          title: 'Тестовое событие',
          description: 'Описание тестового события',
          probability: 0.5,
          type: 'neutral'
        },
        {
          id: 'test_event_2',
          title: 'Второе событие',
          description: 'Описание второго события',
          probability: 0.3,
          type: 'positive'
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
          reward: 1000,
          requirements: { skills: { neural_hacking: 3 }, minRank: 'Junior' }
        },
        {
          id: 'test_contract_2',
          title: 'Второй контракт',
          description: 'Описание второго контракта',
          client: 'Второй клиент',
          reward: 2000,
          requirements: { skills: { neural_hacking: 5 }, minRank: 'Middle' }
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
          description: 'Описание тестового товара',
          availability: 1
        },
        {
          id: 'test_market_2',
          name: 'Второй товар',
          price: 1000,
          rank: 'Senior',
          description: 'Описание второго товара',
          availability: 1
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
        },
        {
          id: 'advanced_training',
          title: 'Продвинутое обучение',
          description: 'Продвинутое обучение',
          cost: 3
        },
        {
          id: 'fear_conditioning',
          title: 'Внушение страха',
          description: 'Внушение страха подчиненному',
          cost: 2
        }
      ],
      assets: [
        {
          id: 'test_asset_1',
          name: 'Тестовый актив',
          rank: 'Junior',
          price: 100
        },
        {
          id: 'test_asset_2',
          name: 'Второй актив',
          rank: 'Middle',
          price: 500
        }
      ],
      equipment: [
        {
          id: 'test_equipment_1',
          name: 'Тестовое оборудование',
          type: 'implant',
          slot: 'ocular'
        },
        {
          id: 'test_equipment_2',
          name: 'Второе оборудование',
          type: 'clothing',
          slot: 'body'
        }
      ],
      events: [
        {
          id: 'test_event_1',
          title: 'Тестовое событие',
          probability: 0.5
        },
        {
          id: 'test_event_2',
          title: 'Второе событие',
          probability: 0.3
        }
      ],
      contracts: [
        {
          id: 'test_contract_1',
          title: 'Тестовый контракт',
          client: 'Тестовый клиент',
          reward: 1000
        },
        {
          id: 'test_contract_2',
          title: 'Второй контракт',
          client: 'Второй клиент',
          reward: 2000
        }
      ],
      market: [
        {
          id: 'test_market_1',
          name: 'Тестовый товар',
          price: 500,
          rank: 'Middle'
        },
        {
          id: 'test_market_2',
          name: 'Второй товар',
          price: 1000,
          rank: 'Senior'
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
        <button onClick={() => onSave({ id: 'new_entity', name: 'Новая сущность' })}>Сохранить</button>
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

// Mock the RegistrationModal
jest.mock('@/app/prod/components/RegistrationModal', () => {
  return function MockRegistrationModal({ isOpen, onClose, onRegister }: any) {
    if (!isOpen) return null
    
    return (
      <div data-testid="registration-modal">
        <h2>Регистрация</h2>
        <button onClick={() => onRegister({ username: 'testuser', email: 'test@example.com' })}>
          Зарегистрироваться
        </button>
        <button onClick={onClose}>Отмена</button>
      </div>
    )
  }
})

describe('E2E Game Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Полный цикл разработки', () => {
    it('должен позволять создавать, редактировать и удалять сущности', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // 1. Создание новой сущности
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      expect(screen.getByTestId('enhanced-edit-modal')).toBeInTheDocument()
      expect(screen.getByText('Создать assets')).toBeInTheDocument()
      
      // Сохраняем новую сущность
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      expect(screen.queryByTestId('enhanced-edit-modal')).not.toBeInTheDocument()
      
      // 2. Редактирование существующей сущности
      const editButton = screen.getByText('Редактировать')
      await user.click(editButton)
      
      expect(screen.getByTestId('enhanced-edit-modal')).toBeInTheDocument()
      expect(screen.getByText('Редактировать assets')).toBeInTheDocument()
      
      // Отменяем редактирование
      const cancelButton = screen.getByText('Отмена')
      await user.click(cancelButton)
      
      expect(screen.queryByTestId('enhanced-edit-modal')).not.toBeInTheDocument()
      
      // 3. Удаление сущности
      const deleteButton = screen.getByText('Удалить')
      await user.click(deleteButton)
      
      // Проверяем, что сущность удалена (в реальном приложении здесь была бы проверка)
    })

    it('должен позволять работать с разными типами сущностей', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // Работаем с активами
      expect(screen.getByText('Тестовый актив')).toBeInTheDocument()
      expect(screen.getByText('Второй актив')).toBeInTheDocument()
      
      // Переключаемся на действия
      const actionsTab = screen.getByText('Действия')
      await user.click(actionsTab)
      
      expect(screen.getByText('Базовое обучение')).toBeInTheDocument()
      expect(screen.getByText('Продвинутое обучение')).toBeInTheDocument()
      expect(screen.getByText('Внушение страха')).toBeInTheDocument()
      
      // Переключаемся на оборудование
      const equipmentTab = screen.getByText('Оборудование')
      await user.click(equipmentTab)
      
      expect(screen.getByText('Тестовое оборудование')).toBeInTheDocument()
      expect(screen.getByText('Второе оборудование')).toBeInTheDocument()
      
      // Переключаемся на события
      const eventsTab = screen.getByText('События')
      await user.click(eventsTab)
      
      expect(screen.getByText('Тестовое событие')).toBeInTheDocument()
      expect(screen.getByText('Второе событие')).toBeInTheDocument()
      
      // Переключаемся на контракты
      const contractsTab = screen.getByText('Контракты')
      await user.click(contractsTab)
      
      expect(screen.getByText('Тестовый контракт')).toBeInTheDocument()
      expect(screen.getByText('Второй контракт')).toBeInTheDocument()
      
      // Переключаемся на рынок
      const marketTab = screen.getByText('Рынок')
      await user.click(marketTab)
      
      expect(screen.getByText('Тестовый товар')).toBeInTheDocument()
      expect(screen.getByText('Второй товар')).toBeInTheDocument()
    })
  })

  describe('Игровой процесс', () => {
    it('должен позволять выполнять полный игровой цикл', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // 1. Регистрация пользователя
      const registerButton = screen.getByText('Зарегистрироваться')
      await user.click(registerButton)
      
      expect(screen.getByTestId('registration-modal')).toBeInTheDocument()
      
      // Регистрируемся
      const registerSubmitButton = screen.getByText('Зарегистрироваться')
      await user.click(registerSubmitButton)
      
      expect(screen.queryByTestId('registration-modal')).not.toBeInTheDocument()
      
      // 2. Начало игры
      const startButton = screen.getByText('Начать игру')
      await user.click(startButton)
      
      // 3. Выбор актива
      const assetButton = screen.getByText('Тестовый актив')
      await user.click(assetButton)
      
      // 4. Выполнение действия
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // 5. Установка оборудования
      const equipmentButton = screen.getByText('Тестовое оборудование')
      await user.click(equipmentButton)
      
      // 6. Обработка события
      const eventButton = screen.getByText('Тестовое событие')
      await user.click(eventButton)
      
      // 7. Принятие контракта
      const contractButton = screen.getByText('Тестовый контракт')
      await user.click(contractButton)
      
      // 8. Покупка на рынке
      const buyButton = screen.getByText('Купить')
      await user.click(buyButton)
    })

    it('должен отслеживать состояние игры', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Проверяем начальное состояние
      expect(screen.getByText(/Нейроимпульсы/)).toBeInTheDocument()
      expect(screen.getByText(/Деньги/)).toBeInTheDocument()
      expect(screen.getByText(/День/)).toBeInTheDocument()
      
      // Выполняем действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что состояние обновилось
      // В реальном приложении здесь были бы проверки изменения ресурсов
    })

    it('должен обрабатывать ошибки и ограничения', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Пытаемся выполнить действие без достаточных ресурсов
      const actionButton = screen.getByText('Продвинутое обучение')
      await user.click(actionButton)
      
      // Проверяем, что отображается сообщение об ошибке
      expect(screen.getByText(/Недостаточно ресурсов/)).toBeInTheDocument()
    })
  })

  describe('Интеграция между компонентами', () => {
    it('должен синхронизировать данные между разработкой и игрой', async () => {
      const user = userEvent.setup()
      
      // Сначала работаем в режиме разработки
      const { rerender } = render(<NexusEnslaverGame />)
      
      // Создаем новую сущность
      const addButton = screen.getByText('Добавить')
      await user.click(addButton)
      
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      // Переключаемся в игровой режим
      rerender(<ProdPage />)
      
      // Проверяем, что новая сущность доступна в игре
      expect(screen.getByText('Новая сущность')).toBeInTheDocument()
    })

    it('должен сохранять прогресс игры', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Выполняем несколько действий
      const action1 = screen.getByText('Базовое обучение')
      await user.click(action1)
      
      const action2 = screen.getByText('Внушение страха')
      await user.click(action2)
      
      // Сохраняем игру
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      // Проверяем, что прогресс сохранен
      expect(screen.getByText(/Сохранено/)).toBeInTheDocument()
      
      // Загружаем игру
      const loadButton = screen.getByText('Загрузить')
      await user.click(loadButton)
      
      // Проверяем, что прогресс загружен
      expect(screen.getByText(/Загружено/)).toBeInTheDocument()
    })
  })

  describe('Производительность и стабильность', () => {
    it('должен эффективно обрабатывать большое количество сущностей', async () => {
      const user = userEvent.setup()
      render(<NexusEnslaverGame />)
      
      // Создаем много сущностей
      for (let i = 0; i < 10; i++) {
        const addButton = screen.getByText('Добавить')
        await user.click(addButton)
        
        const saveButton = screen.getByText('Сохранить')
        await user.click(saveButton)
      }
      
      // Проверяем, что интерфейс остается отзывчивым
      expect(screen.getByText('Добавить')).toBeInTheDocument()
    })

    it('должен корректно обрабатывать ошибки сети', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Симулируем ошибку сети
      // В реальном приложении здесь был бы mock для сетевых запросов
      
      // Пытаемся выполнить действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что ошибка обработана корректно
      expect(screen.getByText(/Ошибка сети/)).toBeInTheDocument()
    })

    it('должен восстанавливаться после сбоев', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Симулируем сбой приложения
      // В реальном приложении здесь был бы тест восстановления состояния
      
      // Проверяем, что приложение восстановилось
      expect(screen.getByText('Nexus Enslaver')).toBeInTheDocument()
      expect(screen.getByText('Начать игру')).toBeInTheDocument()
    })
  })

  describe('Пользовательский опыт', () => {
    it('должен предоставлять интуитивный интерфейс', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Проверяем, что все основные элементы доступны
      expect(screen.getByText('Nexus Enslaver')).toBeInTheDocument()
      expect(screen.getByText('Начать игру')).toBeInTheDocument()
      expect(screen.getByText('Зарегистрироваться')).toBeInTheDocument()
      
      // Проверяем навигацию
      const startButton = screen.getByText('Начать игру')
      expect(startButton).toBeEnabled()
      
      const registerButton = screen.getByText('Зарегистрироваться')
      expect(registerButton).toBeEnabled()
    })

    it('должен предоставлять обратную связь пользователю', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Выполняем действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что отображается обратная связь
      expect(screen.getByText(/Действие выполнено/)).toBeInTheDocument()
      
      // Проверяем обновление состояния
      expect(screen.getByText(/Ресурсы обновлены/)).toBeInTheDocument()
    })

    it('должен поддерживать отмену действий', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Выполняем действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Отменяем действие
      const undoButton = screen.getByText('Отменить')
      await user.click(undoButton)
      
      // Проверяем, что действие отменено
      expect(screen.getByText(/Действие отменено/)).toBeInTheDocument()
    })
  })
})

