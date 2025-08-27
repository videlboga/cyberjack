/**
 * Клиентские утилиты для синхронизации данных с файлами
 */

export async function syncConfigToFiles(configType: string, data: any): Promise<void> {
  try {
    console.log(`🔄 Синхронизируем ${configType} с файлами...`)
    
    const response = await fetch('/api/sync-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ configType, data }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Ошибка синхронизации')
    }
    
    const result = await response.json()
    console.log(`✅ ${result.message}`)
    
  } catch (error) {
    console.error(`❌ Ошибка синхронизации ${configType}:`, error)
    throw error
  }
}

export async function syncAllFromLocalStorage(): Promise<void> {
  try {
    console.log('🔄 Синхронизируем все данные из localStorage с файлами...')
    
    // Получаем данные из localStorage
    const configTypes = ['assets', 'contracts', 'actions', 'events']
    
    for (const configType of configTypes) {
      const savedData = localStorage.getItem(`config_${configType}`)
      if (savedData) {
        const data = JSON.parse(savedData)
        await syncConfigToFiles(configType, data)
      }
    }
    
    console.log('✅ Все данные синхронизированы с файлами')
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации всех данных:', error)
    throw error
  }
}







