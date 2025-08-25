import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
        }
      ]
    }
  }))
}))

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

describe('ProdPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Рендеринг', () => {
    it('должен отображать заголовок игры', () => {
      render(<ProdPage />)
      expect(screen.getByText('Nexus Enslaver')).toBeInTheDocument()
    })

    it('должен отображать описание игры', () => {
      render(<ProdPage />)
      expect(screen.getByText(/Киберпанк-игра/)).toBeInTheDocument()
    })

    it('должен отображать кнопку начала игры', () => {
      render(<ProdPage />)
      expect(screen.getByText('Начать игру')).toBeInTheDocument()
    })

    it('должен отображать кнопку регистрации', () => {
      render(<ProdPage />)
      expect(screen.getByText('Зарегистрироваться')).toBeInTheDocument()
    })
  })

  describe('Регистрация', () => {
    it('должен открывать модалку регистрации при нажатии кнопки', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      const registerButton = screen.getByText('Зарегистрироваться')
      await user.click(registerButton)
      
      expect(screen.getByTestId('registration-modal')).toBeInTheDocument()
    })

    it('должен закрывать модалку регистрации при нажатии отмены', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Открываем модалку
      const registerButton = screen.getByText('Зарегистрироваться')
      await user.click(registerButton)
      
      expect(screen.getByTestId('registration-modal')).toBeInTheDocument()
      
      // Закрываем модалку
      const cancelButton = screen.getByText('Отмена')
      await user.click(cancelButton)
      
      expect(screen.queryByTestId('registration-modal')).not.toBeInTheDocument()
    })

    it('должен обрабатывать регистрацию пользователя', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Открываем модалку
      const registerButton = screen.getByText('Зарегистрироваться')
      await user.click(registerButton)
      
      // Регистрируемся
      const registerSubmitButton = screen.getByText('Зарегистрироваться')
      await user.click(registerSubmitButton)
      
      // Модалка должна закрыться
      expect(screen.queryByTestId('registration-modal')).not.toBeInTheDocument()
    })
  })

  describe('Начало игры', () => {
    it('должен обрабатывать нажатие кнопки начала игры', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      const startButton = screen.getByText('Начать игру')
      await user.click(startButton)
      
      // Здесь можно добавить проверки для логики начала игры
      // когда она будет реализована
    })
  })

  describe('Игровая механика', () => {
    it('должен отображать игровые элементы', () => {
      render(<ProdPage />)
      
      // Проверяем наличие игровых элементов
      expect(screen.getByText(/Нейроимпульсы/)).toBeInTheDocument()
      expect(screen.getByText(/Деньги/)).toBeInTheDocument()
    })

    it('должен отображать список активов', () => {
      render(<ProdPage />)
      
      // Проверяем, что отображается список активов
      expect(screen.getByText('Тестовый актив')).toBeInTheDocument()
    })

    it('должен отображать список действий', () => {
      render(<ProdPage />)
      
      // Проверяем, что отображается список действий
      expect(screen.getByText('Базовое обучение')).toBeInTheDocument()
    })

    it('должен отображать список оборудования', () => {
      render(<ProdPage />)
      
      // Проверяем, что отображается список оборудования
      expect(screen.getByText('Тестовое оборудование')).toBeInTheDocument()
    })
  })

  describe('Взаимодействие с активами', () => {
    it('должен позволять выбирать активы', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Ищем кнопку выбора актива
      const assetButton = screen.getByText('Тестовый актив')
      await user.click(assetButton)
      
      // Проверяем, что актив выбран
      expect(assetButton).toHaveClass('selected')
    })

    it('должен отображать информацию об активе', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Выбираем актив
      const assetButton = screen.getByText('Тестовый актив')
      await user.click(assetButton)
      
      // Проверяем, что отображается информация об активе
      expect(screen.getByText('Junior')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })
  })

  describe('Выполнение действий', () => {
    it('должен позволять выполнять действия', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Ищем кнопку действия
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что действие выполнено
      // Здесь можно добавить проверки изменения состояния
    })

    it('должен обновлять ресурсы после выполнения действия', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Запоминаем начальное количество ресурсов
      const initialNeuralPulses = screen.getByText(/Нейроимпульсы/).textContent
      
      // Выполняем действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что ресурсы изменились
      const newNeuralPulses = screen.getByText(/Нейроимпульсы/).textContent
      expect(newNeuralPulses).not.toBe(initialNeuralPulses)
    })
  })

  describe('Управление оборудованием', () => {
    it('должен позволять устанавливать оборудование', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Ищем кнопку оборудования
      const equipmentButton = screen.getByText('Тестовое оборудование')
      await user.click(equipmentButton)
      
      // Проверяем, что оборудование установлено
      expect(equipmentButton).toHaveClass('installed')
    })

    it('должен применять эффекты оборудования', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Устанавливаем оборудование
      const equipmentButton = screen.getByText('Тестовое оборудование')
      await user.click(equipmentButton)
      
      // Проверяем, что эффекты применены
      // Здесь можно добавить проверки изменения характеристик
    })
  })

  describe('События', () => {
    it('должен отображать события', () => {
      render(<ProdPage />)
      
      // Проверяем, что отображается событие
      expect(screen.getByText('Тестовое событие')).toBeInTheDocument()
    })

    it('должен обрабатывать события', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Ищем событие
      const eventButton = screen.getByText('Тестовое событие')
      await user.click(eventButton)
      
      // Проверяем, что событие обработано
      // Здесь можно добавить проверки изменения состояния
    })
  })

  describe('Контракты', () => {
    it('должен отображать доступные контракты', () => {
      render(<ProdPage />)
      
      // Проверяем, что отображается контракт
      expect(screen.getByText('Тестовый контракт')).toBeInTheDocument()
    })

    it('должен позволять принимать контракты', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Ищем кнопку контракта
      const contractButton = screen.getByText('Тестовый контракт')
      await user.click(contractButton)
      
      // Проверяем, что контракт принят
      expect(contractButton).toHaveClass('accepted')
    })
  })

  describe('Рынок', () => {
    it('должен отображать товары на рынке', () => {
      render(<ProdPage />)
      
      // Проверяем, что отображается товар
      expect(screen.getByText('Тестовый товар')).toBeInTheDocument()
    })

    it('должен позволять покупать товары', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Ищем кнопку покупки
      const buyButton = screen.getByText('Купить')
      await user.click(buyButton)
      
      // Проверяем, что товар куплен
      // Здесь можно добавить проверки изменения состояния
    })
  })

  describe('Состояние игры', () => {
    it('должен отображать текущее состояние игры', () => {
      render(<ProdPage />)
      
      // Проверяем отображение состояния
      expect(screen.getByText(/День/)).toBeInTheDocument()
      expect(screen.getByText(/Время/)).toBeInTheDocument()
    })

    it('должен обновлять состояние при выполнении действий', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Запоминаем начальное состояние
      const initialDay = screen.getByText(/День/).textContent
      
      // Выполняем действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что состояние обновилось
      const newDay = screen.getByText(/День/).textContent
      expect(newDay).not.toBe(initialDay)
    })
  })

  describe('Обработка ошибок', () => {
    it('должен отображать сообщение об ошибке при проблемах с загрузкой', () => {
      // Здесь можно добавить тест для обработки ошибок загрузки
      // когда будет реализована обработка ошибок
    })

    it('должен отображать сообщение при недостатке ресурсов', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Пытаемся выполнить действие без достаточных ресурсов
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Проверяем, что отображается сообщение об ошибке
      expect(screen.getByText(/Недостаточно ресурсов/)).toBeInTheDocument()
    })
  })

  describe('Сохранение и загрузка', () => {
    it('должен сохранять состояние игры', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Выполняем действие
      const actionButton = screen.getByText('Базовое обучение')
      await user.click(actionButton)
      
      // Нажимаем кнопку сохранения
      const saveButton = screen.getByText('Сохранить')
      await user.click(saveButton)
      
      // Проверяем, что состояние сохранено
      expect(screen.getByText(/Сохранено/)).toBeInTheDocument()
    })

    it('должен загружать сохраненное состояние', async () => {
      const user = userEvent.setup()
      render(<ProdPage />)
      
      // Нажимаем кнопку загрузки
      const loadButton = screen.getByText('Загрузить')
      await user.click(loadButton)
      
      // Проверяем, что состояние загружено
      expect(screen.getByText(/Загружено/)).toBeInTheDocument()
    })
  })
})

