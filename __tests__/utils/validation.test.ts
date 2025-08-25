import { 
  validateField, 
  validateForm, 
  validateEmail, 
  validateNumber,
  validateString,
  validateSelect,
  validateDynamicObject,
  validateDynamicArray,
  getValidationErrors
} from '@/app/game/utils/validation'

describe('Validation Utils', () => {
  describe('validateField', () => {
    it('должен валидировать текстовое поле', () => {
      const field = {
        name: 'name',
        type: 'text',
        required: true,
        minLength: 3,
        maxLength: 50
      }

      const validValue = 'Тестовое имя'
      const result = validateField(field, validValue)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в текстовом поле', () => {
      const field = {
        name: 'name',
        type: 'text',
        required: true,
        minLength: 3,
        maxLength: 50
      }

      const invalidValue = 'ab' // Слишком короткое
      const result = validateField(field, invalidValue)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен валидировать числовое поле', () => {
      const field = {
        name: 'price',
        type: 'number',
        required: true,
        min: 0,
        max: 10000
      }

      const validValue = 1000
      const result = validateField(field, validValue)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в числовом поле', () => {
      const field = {
        name: 'price',
        type: 'number',
        required: true,
        min: 0,
        max: 10000
      }

      const invalidValue = -100 // Отрицательное значение
      const result = validateField(field, invalidValue)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен валидировать select поле', () => {
      const field = {
        name: 'rank',
        type: 'select',
        required: true,
        options: ['Junior', 'Middle', 'Senior', 'Elite']
      }

      const validValue = 'Middle'
      const result = validateField(field, validValue)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в select поле', () => {
      const field = {
        name: 'rank',
        type: 'select',
        required: true,
        options: ['Junior', 'Middle', 'Senior', 'Elite']
      }

      const invalidValue = 'InvalidRank'
      const result = validateField(field, invalidValue)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('validateForm', () => {
    it('должен валидировать всю форму', () => {
      const fields = [
        {
          name: 'id',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0
        }
      ]

      const formData = {
        id: 'test_asset',
        name: 'Тестовый актив',
        price: 100
      }

      const result = validateForm(fields, formData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в форме', () => {
      const fields = [
        {
          name: 'id',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0
        }
      ]

      const formData = {
        id: 'ab', // Слишком короткое
        name: '', // Пустое поле
        price: -100 // Отрицательное значение
      }

      const result = validateForm(fields, formData)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен возвращать ошибки для каждого поля', () => {
      const fields = [
        {
          name: 'id',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          minLength: 3
        }
      ]

      const formData = {
        id: 'ab',
        name: ''
      }

      const result = validateForm(fields, formData)
      expect(result.fieldErrors.id).toBeDefined()
      expect(result.fieldErrors.name).toBeDefined()
    })
  })

  describe('validateEmail', () => {
    it('должен валидировать корректный email', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ]

      validEmails.forEach(email => {
        const result = validateEmail(email)
        expect(result.isValid).toBe(true)
      })
    })

    it('должен находить ошибки в некорректном email', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com'
      ]

      invalidEmails.forEach(email => {
        const result = validateEmail(email)
        expect(result.isValid).toBe(false)
      })
    })

    it('должен обрабатывать пустые значения', () => {
      const result = validateEmail('')
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateNumber', () => {
    it('должен валидировать корректные числа', () => {
      const validNumbers = [0, 100, 1000.5, -10]

      validNumbers.forEach(num => {
        const result = validateNumber(num, { min: -100, max: 10000 })
        expect(result.isValid).toBe(true)
      })
    })

    it('должен находить ошибки в некорректных числах', () => {
      const invalidNumbers = [
        { value: -200, min: -100, max: 10000 },
        { value: 15000, min: -100, max: 10000 },
        { value: NaN, min: -100, max: 10000 },
        { value: Infinity, min: -100, max: 10000 }
      ]

      invalidNumbers.forEach(({ value, min, max }) => {
        const result = validateNumber(value, { min, max })
        expect(result.isValid).toBe(false)
      })
    })

    it('должен проверять целые числа', () => {
      const result = validateNumber(5.5, { integer: true })
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateString', () => {
    it('должен валидировать корректные строки', () => {
      const validStrings = [
        { value: 'test', minLength: 3, maxLength: 10 },
        { value: 'Тестовая строка', minLength: 1, maxLength: 50 },
        { value: '', required: false }
      ]

      validStrings.forEach(({ value, ...options }) => {
        const result = validateString(value, options)
        expect(result.isValid).toBe(true)
      })
    })

    it('должен находить ошибки в некорректных строках', () => {
      const invalidStrings = [
        { value: 'ab', minLength: 3, maxLength: 10 },
        { value: 'Слишком длинная строка для теста', minLength: 1, maxLength: 10 },
        { value: '', required: true }
      ]

      invalidStrings.forEach(({ value, ...options }) => {
        const result = validateString(value, options)
        expect(result.isValid).toBe(false)
      })
    })

    it('должен проверять регулярные выражения', () => {
      const result = validateString('test123', { pattern: /^[a-z]+$/ })
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateSelect', () => {
    it('должен валидировать корректные значения select', () => {
      const options = ['Junior', 'Middle', 'Senior', 'Elite']
      const validValues = ['Junior', 'Middle', 'Senior', 'Elite']

      validValues.forEach(value => {
        const result = validateSelect(value, { options })
        expect(result.isValid).toBe(true)
      })
    })

    it('должен находить ошибки в некорректных значениях select', () => {
      const options = ['Junior', 'Middle', 'Senior', 'Elite']
      const invalidValues = ['Invalid', '', null, undefined]

      invalidValues.forEach(value => {
        const result = validateSelect(value, { options })
        expect(result.isValid).toBe(false)
      })
    })

    it('должен обрабатывать множественный выбор', () => {
      const options = ['Junior', 'Middle', 'Senior', 'Elite']
      const validValues = ['Junior', 'Middle']
      const invalidValues = ['Junior', 'Invalid']

      const validResult = validateSelect(validValues, { options, multiple: true })
      expect(validResult.isValid).toBe(true)

      const invalidResult = validateSelect(invalidValues, { options, multiple: true })
      expect(invalidResult.isValid).toBe(false)
    })
  })

  describe('validateDynamicObject', () => {
    it('должен валидировать корректный динамический объект', () => {
      const config = {
        type: 'attributes',
        options: ['strength', 'empathy', 'intelligence'],
        min: 1,
        max: 10
      }

      const validObject = {
        strength: 5,
        empathy: 3,
        intelligence: 7
      }

      const result = validateDynamicObject(validObject, config)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в динамическом объекте', () => {
      const config = {
        type: 'attributes',
        options: ['strength', 'empathy', 'intelligence'],
        min: 1,
        max: 10
      }

      const invalidObject = {
        strength: 15, // Превышает максимум
        invalid_attr: 5, // Неизвестный атрибут
        empathy: -1 // Отрицательное значение
      }

      const result = validateDynamicObject(invalidObject, config)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен проверять минимальное количество ключей', () => {
      const config = {
        type: 'attributes',
        options: ['strength', 'empathy', 'intelligence'],
        minKeys: 2
      }

      const invalidObject = {
        strength: 5
        // Только один ключ, нужно минимум 2
      }

      const result = validateDynamicObject(invalidObject, config)
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateDynamicArray', () => {
    it('должен валидировать корректный динамический массив', () => {
      const config = {
        type: 'preferences',
        options: ['loyal', 'quick_learner', 'tech_savvy'],
        minItems: 1,
        maxItems: 5
      }

      const validArray = ['loyal', 'quick_learner']

      const result = validateDynamicArray(validArray, config)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен находить ошибки в динамическом массиве', () => {
      const config = {
        type: 'preferences',
        options: ['loyal', 'quick_learner', 'tech_savvy'],
        minItems: 1,
        maxItems: 5
      }

      const invalidArray = [
        'loyal',
        'invalid_trait', // Неизвестная черта
        'quick_learner',
        'tech_savvy',
        'loyal', // Дубликат
        'another_trait' // Превышает максимум
      ]

      const result = validateDynamicArray(invalidArray, config)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен проверять уникальность элементов', () => {
      const config = {
        type: 'preferences',
        options: ['loyal', 'quick_learner', 'tech_savvy'],
        unique: true
      }

      const invalidArray = ['loyal', 'quick_learner', 'loyal']

      const result = validateDynamicArray(invalidArray, config)
      expect(result.isValid).toBe(false)
    })
  })

  describe('getValidationErrors', () => {
    it('должен возвращать все ошибки валидации', () => {
      const fields = [
        {
          name: 'id',
          label: 'ID',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'price',
          label: 'Цена',
          type: 'number',
          required: true,
          min: 0
        }
      ]

      const formData = {
        id: 'ab',
        price: -100
      }

      const errors = getValidationErrors(fields, formData)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(error => error.includes('ID'))).toBe(true)
      expect(errors.some(error => error.includes('Цена') || error.includes('не может быть меньше'))).toBe(true)
    })

    it('должен возвращать пустой массив для корректных данных', () => {
      const fields = [
        {
          name: 'id',
          label: 'ID',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'price',
          label: 'Цена',
          type: 'number',
          required: true,
          min: 0
        }
      ]

      const formData = {
        id: 'test_asset',
        price: 100
      }

      const errors = getValidationErrors(fields, formData)
      expect(errors).toHaveLength(0)
    })

    it('должен группировать ошибки по полям', () => {
      const fields = [
        {
          name: 'id',
          label: 'ID',
          type: 'text',
          required: true,
          minLength: 3
        },
        {
          name: 'name',
          label: 'Имя',
          type: 'text',
          required: true,
          minLength: 3
        }
      ]

      const formData = {
        id: 'ab',
        name: ''
      }

      const errors = getValidationErrors(fields, formData, { groupByField: true })
      expect(errors.id).toBeDefined()
      expect(errors.name).toBeDefined()
      expect(Array.isArray(errors.id)).toBe(true)
      expect(Array.isArray(errors.name)).toBe(true)
    })
  })
})
