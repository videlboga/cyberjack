import { getFieldConfig, getEntityDisplayName, entityFieldConfigs, baseFields } from '@/lib/field-configs'

describe('Field Configs', () => {
  describe('getFieldConfig', () => {
    it('должен возвращать конфигурацию для активов', () => {
      const config = getFieldConfig('assets')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем базовые поля
      const idField = config.find(field => field.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('text')
      expect(idField?.required).toBe(true)
      
      // Проверяем специфичные поля активов
      const nameField = config.find(field => field.name === 'name')
      expect(nameField).toBeDefined()
      expect(nameField?.type).toBe('text')
      
      const rankField = config.find(field => field.name === 'rank')
      expect(rankField).toBeDefined()
      expect(rankField?.type).toBe('select')
      expect(rankField?.options).toContain('Junior')
      expect(rankField?.options).toContain('Middle')
      expect(rankField?.options).toContain('Senior')
      expect(rankField?.options).toContain('Elite')
      
      // Проверяем динамические объекты
      const attributesField = config.find(field => field.name === 'attributes')
      expect(attributesField).toBeDefined()
      expect(attributesField?.type).toBe('dynamic-object')
      expect(attributesField?.dynamicConfig?.type).toBe('attributes')
      expect(attributesField?.dynamicConfig?.options).toContain('strength')
      expect(attributesField?.dynamicConfig?.options).toContain('empathy')
      expect(attributesField?.dynamicConfig?.options).toContain('intelligence')
      
      // Проверяем динамические массивы
      const traitsField = config.find(field => field.name === 'traits')
      expect(traitsField).toBeDefined()
      expect(traitsField?.type).toBe('dynamic-array')
      expect(traitsField?.dynamicConfig?.type).toBe('preferences')
    })

    it('должен возвращать конфигурацию для действий', () => {
      const config = getFieldConfig('actions')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем поля действий
      const titleField = config.find(field => field.name === 'title')
      expect(titleField).toBeDefined()
      expect(titleField?.type).toBe('text')
      expect(titleField?.required).toBe(true)
      
      const costField = config.find(field => field.name === 'cost')
      expect(costField).toBeDefined()
      expect(costField?.type).toBe('number')
      expect(costField?.min).toBe(0)
      expect(costField?.max).toBe(1000)
      
      // Проверяем динамические объекты
      const effectsField = config.find(field => field.name === 'effects')
      expect(effectsField).toBeDefined()
      expect(effectsField?.type).toBe('dynamic-object')
      expect(effectsField?.dynamicConfig?.type).toBe('effects')
    })

    it('должен возвращать конфигурацию для оборудования', () => {
      const config = getFieldConfig('equipment')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем базовые поля
      const idField = config.find(field => field.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('text')
      
      const nameField = config.find(field => field.name === 'name')
      expect(nameField).toBeDefined()
      expect(nameField?.type).toBe('text')
      
      const typeField = config.find(field => field.name === 'type')
      expect(typeField).toBeDefined()
      expect(typeField?.type).toBe('select')
      expect(typeField?.options).toContain('implant')
      expect(typeField?.options).toContain('clothing')
      expect(typeField?.options).toContain('device')
      
      const slotField = config.find(field => field.name === 'slot')
      expect(slotField).toBeDefined()
      expect(slotField?.type).toBe('select')
      expect(slotField?.options).toContain('ocular')
      expect(slotField?.options).toContain('body')
      expect(slotField?.options).toContain('head')
      expect(slotField?.options).toContain('neural')
      
      const removableField = config.find(field => field.name === 'removable')
      expect(removableField).toBeDefined()
      expect(removableField?.type).toBe('switch')
      
      // Проверяем динамические объекты
      const effectsField = config.find(field => field.name === 'effects')
      expect(effectsField).toBeDefined()
      expect(effectsField?.type).toBe('dynamic-object')
      expect(effectsField?.dynamicConfig?.type).toBe('effects')
      
      // Проверяем динамические массивы
      const modesField = config.find(field => field.name === 'modes')
      expect(modesField).toBeDefined()
      expect(modesField?.type).toBe('dynamic-array')
      expect(modesField?.dynamicConfig?.type).toBe('preferences')
    })

    it('должен возвращать конфигурацию для пользователей', () => {
      const config = getFieldConfig('users')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем базовые поля
      const idField = config.find(field => field.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('text')
      
      const usernameField = config.find(field => field.name === 'username')
      expect(usernameField).toBeDefined()
      expect(usernameField?.type).toBe('text')
      expect(usernameField?.required).toBe(true)
      
      const emailField = config.find(field => field.name === 'email')
      expect(emailField).toBeDefined()
      expect(emailField?.type).toBe('text')
      expect(emailField?.required).toBe(true)
      
      const roleField = config.find(field => field.name === 'role')
      expect(roleField).toBeDefined()
      expect(roleField?.type).toBe('select')
      expect(roleField?.options).toContain('admin')
      expect(roleField?.options).toContain('user')
      expect(roleField?.options).toContain('trader')
      
      const statusField = config.find(field => field.name === 'status')
      expect(statusField).toBeDefined()
      expect(statusField?.type).toBe('select')
      expect(statusField?.options).toContain('active')
      expect(statusField?.options).toContain('inactive')
      expect(statusField?.options).toContain('banned')
    })

    it('должен возвращать конфигурацию для событий', () => {
      const config = getFieldConfig('events')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем поля событий
      const titleField = config.find(field => field.name === 'title')
      expect(titleField).toBeDefined()
      expect(titleField?.type).toBe('text')
      
      const probabilityField = config.find(field => field.name === 'probability')
      expect(probabilityField).toBeDefined()
      expect(probabilityField?.type).toBe('slider')
      expect(probabilityField?.min).toBe(0)
      expect(probabilityField?.max).toBe(1)
      expect(probabilityField?.step).toBe(0.01)
      
      const durationField = config.find(field => field.name === 'duration')
      expect(durationField).toBeDefined()
      expect(durationField?.type).toBe('number')
      expect(durationField?.min).toBe(1)
      expect(durationField?.max).toBe(30)
      
      // Проверяем динамические объекты
      const effectsField = config.find(field => field.name === 'effects')
      expect(effectsField).toBeDefined()
      expect(effectsField?.type).toBe('dynamic-object')
      expect(effectsField?.dynamicConfig?.type).toBe('effects')
    })

    it('должен возвращать конфигурацию для контрактов', () => {
      const config = getFieldConfig('contracts')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем поля контрактов
      const titleField = config.find(field => field.name === 'title')
      expect(titleField).toBeDefined()
      expect(titleField?.type).toBe('text')
      
      const clientField = config.find(field => field.name === 'client')
      expect(clientField).toBeDefined()
      expect(clientField?.type).toBe('text')
      
      const rewardField = config.find(field => field.name === 'reward')
      expect(rewardField).toBeDefined()
      expect(rewardField?.type).toBe('number')
      expect(rewardField?.min).toBe(0)
      expect(rewardField?.max).toBe(10000)
      
      const deadlineField = config.find(field => field.name === 'deadline')
      expect(deadlineField).toBeDefined()
      expect(deadlineField?.type).toBe('number')
      expect(deadlineField?.min).toBe(1)
      expect(deadlineField?.max).toBe(365)
      
      const difficultyField = config.find(field => field.name === 'difficulty')
      expect(difficultyField).toBeDefined()
      expect(difficultyField?.type).toBe('select')
      expect(difficultyField?.options).toContain('easy')
      expect(difficultyField?.options).toContain('medium')
      expect(difficultyField?.options).toContain('hard')
    })

    it('должен возвращать конфигурацию для сцен', () => {
      const config = getFieldConfig('scenes')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем поля сцен
      const titleField = config.find(field => field.name === 'title')
      expect(titleField).toBeDefined()
      expect(titleField?.type).toBe('text')
      
      const typeField = config.find(field => field.name === 'type')
      expect(typeField).toBeDefined()
      expect(typeField?.type).toBe('select')
      expect(typeField?.options).toContain('dialogue')
      expect(typeField?.options).toContain('action')
      expect(typeField?.options).toContain('choice')
      expect(typeField?.options).toContain('narrative')
      
      // Проверяем динамические массивы
      const charactersField = config.find(field => field.name === 'characters')
      expect(charactersField).toBeDefined()
      expect(charactersField?.type).toBe('dynamic-array')
      expect(charactersField?.dynamicConfig?.type).toBe('preferences')
      
      const choicesField = config.find(field => field.name === 'choices')
      expect(choicesField).toBeDefined()
      expect(choicesField?.type).toBe('dynamic-array')
      expect(choicesField?.dynamicConfig?.type).toBe('preferences')
    })

    it('должен возвращать базовую конфигурацию для неизвестных типов', () => {
      const config = getFieldConfig('unknown_type')
      
      expect(config).toBeDefined()
      expect(config.length).toBeGreaterThan(0)
      
      // Проверяем базовые поля
      const idField = config.find(field => field.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('text')
      
      const nameField = config.find(field => field.name === 'name')
      expect(nameField).toBeDefined()
      expect(nameField?.type).toBe('text')
      
      const descriptionField = config.find(field => field.name === 'description')
      expect(descriptionField).toBeDefined()
      expect(descriptionField?.type).toBe('textarea')
    })

    it('должен обрабатывать множественное число в типах', () => {
      const assetsConfig = getFieldConfig('assets')
      const assetConfig = getFieldConfig('asset')
      
      // Оба должны возвращать одинаковую конфигурацию (assets)
      expect(assetsConfig).toEqual(assetConfig)
      expect(assetsConfig).toBe(entityFieldConfigs.assets)
    })
  })

  describe('getEntityDisplayName', () => {
    it('должен возвращать правильные отображаемые имена', () => {
      expect(getEntityDisplayName('assets')).toBe('актив')
      expect(getEntityDisplayName('asset')).toBe('актив')
      expect(getEntityDisplayName('actions')).toBe('действие')
      expect(getEntityDisplayName('action')).toBe('действие')
      expect(getEntityDisplayName('equipment')).toBe('оборудование')
      expect(getEntityDisplayName('users')).toBe('пользователя')
      expect(getEntityDisplayName('user')).toBe('пользователя')
      expect(getEntityDisplayName('events')).toBe('событие')
      expect(getEntityDisplayName('event')).toBe('событие')
      expect(getEntityDisplayName('contracts')).toBe('контракт')
      expect(getEntityDisplayName('contract')).toBe('контракт')
      expect(getEntityDisplayName('scenes')).toBe('сцену')
      expect(getEntityDisplayName('scene')).toBe('сцену')
      expect(getEntityDisplayName('categories')).toBe('категорию')
      expect(getEntityDisplayName('category')).toBe('категорию')
    })

    it('должен возвращать исходный тип для неизвестных типов', () => {
      expect(getEntityDisplayName('unknown_type')).toBe('unknown_type')
      expect(getEntityDisplayName('custom_entity')).toBe('custom_entity')
    })
  })

  describe('baseFields', () => {
    it('должен содержать базовые поля', () => {
      expect(baseFields).toBeDefined()
      expect(baseFields.length).toBeGreaterThan(0)
      
      const idField = baseFields.find(field => field.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('text')
      expect(idField?.label).toBe('ID')
      expect(idField?.required).toBe(true)
    })
  })

  describe('entityFieldConfigs', () => {
    it('должен содержать конфигурации для всех типов сущностей', () => {
      expect(entityFieldConfigs).toBeDefined()
      expect(entityFieldConfigs.assets).toBeDefined()
      expect(entityFieldConfigs.actions).toBeDefined()
      expect(entityFieldConfigs.equipment).toBeDefined()
      expect(entityFieldConfigs.users).toBeDefined()
      expect(entityFieldConfigs.events).toBeDefined()
      expect(entityFieldConfigs.contracts).toBeDefined()
      expect(entityFieldConfigs.scenes).toBeDefined()
    })

    it('должен содержать правильную структуру конфигураций', () => {
      Object.entries(entityFieldConfigs).forEach(([entityType, config]) => {
        expect(Array.isArray(config)).toBe(true)
        expect(config.length).toBeGreaterThan(0)
        
        config.forEach(field => {
          expect(field).toHaveProperty('name')
          expect(field).toHaveProperty('type')
          expect(field).toHaveProperty('label')
          expect(typeof field.name).toBe('string')
          expect(typeof field.type).toBe('string')
          expect(typeof field.label).toBe('string')
        })
      })
    })
  })
})
