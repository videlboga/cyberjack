import { 
  validateConfig, 
  mergeConfigs, 
  validateEntity, 
  sanitizeConfig,
  getConfigDiff,
  validateRequiredFields
} from '@/app/game/utils/configHelpers'

describe('Config Helpers', () => {
  describe('validateConfig', () => {
    it('должен валидировать корректную конфигурацию', () => {
      const validConfig = {
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
              id: 'test_asset',
              name: 'Тестовый актив',
              rank: 'Junior',
              price: 100
            }
          ]
        },
        equipment: {},
        events: {},
        contracts: {},
        market: {}
      }

      const result = validateConfig(validConfig)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в некорректной конфигурации', () => {
      const invalidConfig = {
        actions: {
          categories: {
            training: {
              // Отсутствует title
              description: 'Обучение навыкам',
              actions: {
                basic: {
                  // Отсутствует title
                  cost: 'invalid_cost', // Неправильный тип
                  effects: { skills: { technical: 1 } }
                }
              }
            }
          }
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен проверять обязательные поля', () => {
      const config = {
        actions: {
          categories: {
            training: {
              actions: {
                basic: {
                  cost: 1
                  // Отсутствует title и description
                }
              }
            }
          }
        },
        assets: {},
        equipment: {},
        events: {},
        contracts: {},
        market: {}
      }

      const result = validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('title'))).toBe(true)
    })
  })

  describe('mergeConfigs', () => {
    it('должен объединять две конфигурации', () => {
      const baseConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1
                }
              }
            }
          }
        }
      }

      const overrideConfig = {
        actions: {
          categories: {
            training: {
              actions: {
                advanced: {
                  title: 'Продвинутое обучение',
                  cost: 2
                }
              }
            }
          }
        }
      }

      const result = mergeConfigs(baseConfig, overrideConfig)
      
      expect(result.actions.categories.training.actions.basic).toBeDefined()
      expect(result.actions.categories.training.actions.advanced).toBeDefined()
      expect(result.actions.categories.training.actions.advanced.title).toBe('Продвинутое обучение')
    })

    it('должен перезаписывать существующие значения', () => {
      const baseConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1
                }
              }
            }
          }
        }
      }

      const overrideConfig = {
        actions: {
          categories: {
            training: {
              actions: {
                basic: {
                  title: 'Обновленное обучение',
                  cost: 5
                }
              }
            }
          }
        }
      }

      const result = mergeConfigs(baseConfig, overrideConfig)
      
      expect(result.actions.categories.training.actions.basic.title).toBe('Обновленное обучение')
      expect(result.actions.categories.training.actions.basic.cost).toBe(5)
    })

    it('должен обрабатывать глубокое слияние', () => {
      const baseConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              description: 'Описание',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1,
                  effects: { skills: { technical: 1 } }
                }
              }
            }
          }
        }
      }

      const overrideConfig = {
        actions: {
          categories: {
            training: {
              actions: {
                basic: {
                  effects: { skills: { technical: 2, hacking: 1 } }
                }
              }
            }
          }
        }
      }

      const result = mergeConfigs(baseConfig, overrideConfig)
      
      expect(result.actions.categories.training.title).toBe('Обучение')
      expect(result.actions.categories.training.actions.basic.effects.skills.technical).toBe(2)
      expect(result.actions.categories.training.actions.basic.effects.skills.hacking).toBe(1)
    })
  })

  describe('validateEntity', () => {
    it('должен валидировать корректную сущность', () => {
      const validEntity = {
        id: 'test_asset',
        name: 'Тестовый актив',
        rank: 'Junior',
        price: 100,
        description: 'Описание'
      }

      const result = validateEntity(validEntity, 'assets')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в некорректной сущности', () => {
      const invalidEntity = {
        // Отсутствует id
        name: 'Тестовый актив',
        rank: 'InvalidRank', // Неправильное значение
        price: -100 // Отрицательная цена
      }

      const result = validateEntity(invalidEntity, 'assets')
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен проверять типы данных', () => {
      const invalidEntity = {
        id: 'test_asset',
        name: 'Тестовый актив',
        rank: 'Junior',
        price: 'invalid_price', // Строка вместо числа
        description: 'Описание'
      }

      const result = validateEntity(invalidEntity, 'assets')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('price'))).toBe(true)
    })

    it('должен проверять диапазоны значений', () => {
      const invalidEntity = {
        id: 'test_asset',
        name: 'Тестовый актив',
        rank: 'Junior',
        price: 100000, // Слишком высокая цена
        description: 'Описание'
      }

      const result = validateEntity(invalidEntity, 'assets')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('price'))).toBe(true)
    })
  })

  describe('sanitizeConfig', () => {
    it('должен очищать конфигурацию от опасных данных', () => {
      const config = {
        actions: {
          categories: {
            training: {
              title: '<script>alert("xss")</script>Обучение',
              description: 'Описание<script>alert("xss")</script>',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1
                }
              }
            }
          }
        }
      }

      const result = sanitizeConfig(config)
      
      expect(result.actions.categories.training.title).not.toContain('<script>')
      expect(result.actions.categories.training.description).not.toContain('<script>')
    })

    it('должен удалять пустые поля', () => {
      const config = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              description: '',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1,
                  description: null
                }
              }
            }
          }
        }
      }

      const result = sanitizeConfig(config)
      
      expect(result.actions.categories.training.description).toBeUndefined()
      expect(result.actions.categories.training.actions.basic.description).toBeUndefined()
    })

    it('должен нормализовать типы данных', () => {
      const config = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: '1', // Строка
                  price: 100.0 // Число с плавающей точкой
                }
              }
            }
          }
        }
      }

      const result = sanitizeConfig(config)
      
      expect(typeof result.actions.categories.training.actions.basic.cost).toBe('number')
      expect(typeof result.actions.categories.training.actions.basic.price).toBe('number')
    })
  })

  describe('getConfigDiff', () => {
    it('должен находить различия между конфигурациями', () => {
      const oldConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1
                }
              }
            }
          }
        }
      }

      const newConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 2 // Изменено
                },
                advanced: { // Добавлено
                  title: 'Продвинутое обучение',
                  cost: 3
                }
              }
            }
          }
        }
      }

      const diff = getConfigDiff(oldConfig, newConfig)
      
      expect(diff.changed).toContain('actions.categories.training.actions.basic.cost')
      expect(diff.added).toContain('actions.categories.training.actions.advanced')
      expect(diff.removed).toHaveLength(0)
    })

    it('должен находить удаленные поля', () => {
      const oldConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1
                },
                old: { // Будет удалено
                  title: 'Старое обучение',
                  cost: 1
                }
              }
            }
          }
        }
      }

      const newConfig = {
        actions: {
          categories: {
            training: {
              title: 'Обучение',
              actions: {
                basic: {
                  title: 'Базовое обучение',
                  cost: 1
                }
              }
            }
          }
        }
      }

      const diff = getConfigDiff(oldConfig, newConfig)
      
      expect(diff.removed).toContain('actions.categories.training.actions.old')
    })
  })

  describe('validateRequiredFields', () => {
    it('должен проверять обязательные поля', () => {
      const entity = {
        id: 'test_asset',
        name: 'Тестовый актив',
        // Отсутствует rank
        price: 100
      }

      const requiredFields = ['id', 'name', 'rank']
      const result = validateRequiredFields(entity, requiredFields)
      
      expect(result.isValid).toBe(false)
      expect(result.missingFields).toContain('rank')
    })

    it('должен проходить валидацию при наличии всех обязательных полей', () => {
      const entity = {
        id: 'test_asset',
        name: 'Тестовый актив',
        rank: 'Junior',
        price: 100
      }

      const requiredFields = ['id', 'name', 'rank']
      const result = validateRequiredFields(entity, requiredFields)
      
      expect(result.isValid).toBe(true)
      expect(result.missingFields).toHaveLength(0)
    })

    it('должен проверять, что поля не пустые', () => {
      const entity = {
        id: 'test_asset',
        name: '', // Пустое поле
        rank: 'Junior',
        price: 100
      }

      const requiredFields = ['id', 'name', 'rank']
      const result = validateRequiredFields(entity, requiredFields)
      
      expect(result.isValid).toBe(false)
      expect(result.missingFields).toContain('name')
    })
  })
})
