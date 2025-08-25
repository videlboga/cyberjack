import { useState, useCallback } from 'react'
import { saveConfigToFile } from '@/lib/config-sync'
import { syncConfigToFiles } from '@/lib/sync-utils'
import { syncLegacyToUnifiedConfig } from '@/lib/unified-config-adapter'

export interface ConfigState {
  assets: any
  actions: any
  contracts: any
  events: any
  market: any
  equipment: any
  system: any
  users: any
}

export const useConfigManager = (initialConfigs: ConfigState) => {
  const [configs, setConfigs] = useState<ConfigState>(initialConfigs)

  // Функция для обновления конфигураций извне
  const updateConfigs = useCallback((newConfigs: ConfigState) => {
    console.log('🔄 Обновляем configs в useConfigManager:', newConfigs)
    setConfigs(newConfigs)
  }, [])

  const updateConfig = useCallback((configType: keyof ConfigState, data: any) => {
    setConfigs(prev => ({
      ...prev,
      [configType]: data
    }))
  }, [])

  const updateConfigItem = useCallback((
    configType: keyof ConfigState, 
    itemId: string, 
    updatedItem: any,
    category?: string
  ) => {
    setConfigs(prev => {
      const currentConfig = prev[configType]
      let updatedConfig
      
      if (category && currentConfig[category]) {
        // Обновляем элемент в категории
        updatedConfig = {
          ...currentConfig,
          [category]: currentConfig[category].map((item: any) => 
            item.id === itemId ? updatedItem : item
          )
        }
      } else if (Array.isArray(currentConfig)) {
        // Обновляем элемент в массиве
        updatedConfig = currentConfig.map((item: any) => 
          item.id === itemId ? updatedItem : item
        )
      } else if (currentConfig.items && Array.isArray(currentConfig.items)) {
        // Обновляем элемент в items
        updatedConfig = {
          ...currentConfig,
          items: currentConfig.items.map((item: any) => 
            item.id === itemId ? updatedItem : item
          )
        }
      } else if (currentConfig.assets && Array.isArray(currentConfig.assets)) {
        // Специальная обработка для assets конфига
        updatedConfig = {
          ...currentConfig,
          assets: currentConfig.assets.map((item: any) => 
            item.id === itemId ? updatedItem : item
          )
        }
        console.log(`💎 Обновлен актив ${itemId}, теперь ${updatedConfig.assets.length} активов`)
      } else if (currentConfig.users && Array.isArray(currentConfig.users)) {
        // Специальная обработка для users конфига
        updatedConfig = {
          ...currentConfig,
          users: currentConfig.users.map((item: any) => 
            item.id === itemId ? updatedItem : item
          )
        }
        console.log(`👥 Обновлен пользователь ${itemId}, теперь ${updatedConfig.users.length} пользователей`)
      } else {
        return prev
      }
      
      const newConfigs = {
        ...prev,
        [configType]: updatedConfig
      }
      
      // Сохраняем изменения
      try {
        saveConfigToFile(configType, updatedConfig)
        // Синхронизируем с файлами
        syncConfigToFiles(configType, updatedConfig)
      } catch (error) {
        console.error(`Ошибка сохранения при обновлении ${configType}:`, error)
      }
      
      return newConfigs
    })
  }, [])

  const addConfigItem = useCallback((
    configType: keyof ConfigState, 
    newItem: any,
    category?: string
  ) => {
    // Генерируем уникальный ID для новых активов
    if (configType === 'assets' && !newItem.id) {
      newItem.id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    console.log(`➕ Добавление новой сущности: ${configType}`, newItem)
    
    setConfigs(prev => {
      console.log('🔄 Текущее состояние configs для добавления:', prev)
      const currentConfig = prev[configType]
      console.log(`📦 Текущий конфиг для ${configType}:`, currentConfig)
      let updatedConfig
      
      if (category && currentConfig[category]) {
        // Добавляем элемент в категорию
        updatedConfig = {
          ...currentConfig,
          [category]: [...currentConfig[category], newItem]
        }
        console.log(`📝 Добавлен в категорию ${category}`)
      } else if (Array.isArray(currentConfig)) {
        // Добавляем элемент в массив
        updatedConfig = [...currentConfig, newItem]
        console.log(`📝 Добавлен в массив, теперь ${updatedConfig.length} элементов`)
      } else if (currentConfig.users && Array.isArray(currentConfig.users)) {
        // Специальная обработка для users конфига
        updatedConfig = {
          ...currentConfig,
          users: [...currentConfig.users, newItem]
        }
        console.log(`👥 Добавлен пользователь, теперь ${updatedConfig.users.length} пользователей`)
      } else if (currentConfig.assets && Array.isArray(currentConfig.assets)) {
        // Специальная обработка для assets конфига
        updatedConfig = {
          ...currentConfig,
          assets: [...currentConfig.assets, newItem]
        }
        console.log(`💎 Добавлен актив, теперь ${updatedConfig.assets.length} активов`)
      } else {
        // Универсальная обработка для всех остальных конфигов
        const arrayKeys = Object.keys(currentConfig).filter(key => 
          Array.isArray(currentConfig[key]) && 
          currentConfig[key].length > 0 && 
          currentConfig[key][0] && 
          typeof currentConfig[key][0] === 'object' && 
          'id' in currentConfig[key][0]
        )
        
        if (arrayKeys.length > 0) {
          const arrayKey = arrayKeys[0]
          updatedConfig = {
            ...currentConfig,
            [arrayKey]: [...currentConfig[arrayKey], newItem]
          }
          console.log(`🔍 Добавлен в массив ${arrayKey}, теперь ${updatedConfig[arrayKey].length} элементов`)
        } else {
          console.warn('⚠️ Неизвестная структура конфига для добавления:', configType, currentConfig)
          return prev
        }
      }
      
      const newConfigs = {
        ...prev,
        [configType]: updatedConfig
      }
      
      console.log('🔄 Новое состояние configs:', newConfigs)
      console.log(`📦 Обновленный конфиг для ${configType}:`, updatedConfig)
      console.log(`🔍 Проверяем assets в новом состоянии:`, newConfigs.assets?.assets?.length || 0, 'активов')
      
      // Сохраняем изменения
      try {
        saveConfigToFile(configType, updatedConfig)
        // Синхронизируем с файлами
        syncConfigToFiles(configType, updatedConfig)
        console.log(`✅ Сущность добавлена в ${configType}`)
      } catch (error) {
        console.error(`❌ Ошибка сохранения при добавлении ${configType}:`, error)
      }
      
      return newConfigs
    })
  }, [])

  const removeConfigItem = useCallback((
    configType: keyof ConfigState, 
    itemId: string,
    category?: string
  ) => {
    console.log(`🗑️ Мягкое удаление: ${configType}, ID: ${itemId}`)
    
    setConfigs(prev => {
      console.log('🔄 Текущее состояние configs:', prev)
      const currentConfig = prev[configType]
      console.log(`📦 Текущий конфиг для ${configType}:`, currentConfig)
      let updatedConfig
      
      if (category && currentConfig[category]) {
        // Помечаем элемент как удаленный в категории
        updatedConfig = {
          ...currentConfig,
          [category]: currentConfig[category].map((item: any) => 
            item.id === itemId ? { ...item, deleted: true, deletedAt: new Date().toISOString() } : item
          )
        }
      } else if (Array.isArray(currentConfig)) {
        // Помечаем элемент как удаленный в массиве
        console.log('📝 Текущий конфиг (массив):', currentConfig.length, 'элементов')
        updatedConfig = currentConfig.map((item: any) => 
          item.id === itemId ? { ...item, deleted: true, deletedAt: new Date().toISOString() } : item
        )
        console.log('✏️ Обновленный конфиг:', updatedConfig.length, 'элементов')
        console.log('🔍 Найден удаленный элемент:', updatedConfig.find((item: any) => item.id === itemId))
      } else if (currentConfig.users && Array.isArray(currentConfig.users)) {
        // Специальная обработка для users конфига
        console.log('👥 Текущий конфиг users:', currentConfig.users.length, 'элементов')
        updatedConfig = {
          ...currentConfig,
          users: currentConfig.users.map((item: any) => 
            item.id === itemId ? { ...item, deleted: true, deletedAt: new Date().toISOString() } : item
          )
        }
        console.log('✏️ Обновленный конфиг users:', updatedConfig.users.length, 'элементов')
        console.log('🔍 Найден удаленный элемент:', updatedConfig.users.find((item: any) => item.id === itemId))
      } else if (currentConfig.assets && Array.isArray(currentConfig.assets)) {
        // Специальная обработка для assets конфига
        console.log('💎 Текущий конфиг assets:', currentConfig.assets.length, 'элементов')
        updatedConfig = {
          ...currentConfig,
          assets: currentConfig.assets.map((item: any) => 
            item.id === itemId ? { ...item, deleted: true, deletedAt: new Date().toISOString() } : item
          )
        }
        console.log('✏️ Обновленный конфиг assets:', updatedConfig.assets.length, 'элементов')
        console.log('🔍 Найден удаленный элемент:', updatedConfig.assets.find((item: any) => item.id === itemId))
      } else {
        // Универсальная обработка для всех остальных конфигов
        // Ищем массив в объекте конфига
        const arrayKeys = Object.keys(currentConfig).filter(key => 
          Array.isArray(currentConfig[key]) && 
          currentConfig[key].length > 0 && 
          currentConfig[key][0] && 
          typeof currentConfig[key][0] === 'object' && 
          'id' in currentConfig[key][0]
        )
        
        if (arrayKeys.length > 0) {
          const arrayKey = arrayKeys[0] // Берем первый найденный массив
          console.log(`🔍 Найден массив ${arrayKey} в конфиге ${configType}:`, currentConfig[arrayKey].length, 'элементов')
          
          updatedConfig = {
            ...currentConfig,
            [arrayKey]: currentConfig[arrayKey].map((item: any) => 
              item.id === itemId ? { ...item, deleted: true, deletedAt: new Date().toISOString() } : item
            )
          }
          
          console.log(`✏️ Обновленный массив ${arrayKey}:`, updatedConfig[arrayKey].length, 'элементов')
          console.log('🔍 Найден удаленный элемент:', updatedConfig[arrayKey].find((item: any) => item.id === itemId))
        } else {
          console.warn('⚠️ Неизвестная структура конфига для удаления:', configType, currentConfig)
          return prev
        }
      }
      
      const newConfigs = {
        ...prev,
        [configType]: updatedConfig
      }
      
      console.log('🔄 Новое состояние configs:', newConfigs)
      console.log(`📦 Обновленный конфиг для ${configType}:`, updatedConfig)
      
      // Сохраняем изменения
      try {
        saveConfigToFile(configType, updatedConfig)
        console.log(`✅ Сущность ${itemId} помечена как удаленная`)
        
        // Синхронизируем изменения обратно в unified конфигурацию для персонажей
        if (configType === 'assets') {
          const newConfigs = {
            ...prev,
            [configType]: updatedConfig
          }
          syncLegacyToUnifiedConfig(newConfigs).catch(error => {
            console.error('❌ Ошибка синхронизации с unified конфигурацией:', error)
          })
        }
      } catch (error) {
        console.error(`❌ Ошибка сохранения при удалении ${configType}:`, error)
      }
      
      return newConfigs
    })
  }, [])

  const exportConfig = useCallback((configType: keyof ConfigState) => {
    const dataStr = JSON.stringify(configs[configType], null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${configType}-config.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [configs])

  return {
    configs,
    updateConfig,
    updateConfigItem,
    addConfigItem,
    removeConfigItem,
    exportConfig,
    updateConfigs
  }
}

