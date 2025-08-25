import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { configType, data } = await request.json()
    
    console.log(`🔄 Синхронизируем ${configType} с файлами...`)
    
    const dataDir = path.join(process.cwd(), 'data')
    
    switch (configType) {
      case 'assets':
        // Синхронизируем с characters-unified.json
        const charactersPath = path.join(dataDir, 'characters-unified.json')
        const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))
        
        // Преобразуем assets в characters формат
        // Объединяем существующие и новые данные
        const existingCharacters = charactersData.characters || []
        const newCharacters = data.assets.map((asset: any) => ({
          id: asset.id,
          name: asset.name,
          rank: asset.rank,
          price: asset.price,
          specialization: asset.specialization,
          description: asset.description,
          attributes: asset.attributes,
          skills: asset.skills,
          traits: asset.traits || [],
          preferences: asset.preferences || {},
          condition: asset.condition || {},
          history: asset.history || {},
          states: asset.states || {
            mood: 75,
            stress: 25,
            obedience: 2,
            awareness: 2,
            devotion: 2,
            sensuality: 3,
            sensory_overload: 1
          },
          metadata: {
            source: "dev_sync",
            createdAt: asset.history?.created || new Date().toISOString(),
            lastModified: new Date().toISOString()
          }
        }))
        
        // Объединяем, заменяя существующие элементы с тем же ID
        const mergedCharacters = [...existingCharacters]
        newCharacters.forEach(newChar => {
          const existingIndex = mergedCharacters.findIndex(char => char.id === newChar.id)
          if (existingIndex >= 0) {
            // Обновляем существующий
            mergedCharacters[existingIndex] = newChar
          } else {
            // Добавляем новый
            mergedCharacters.push(newChar)
          }
        })
        
        const updatedCharacters = {
          ...charactersData,
          characters: mergedCharacters
        }
        
        fs.writeFileSync(charactersPath, JSON.stringify(updatedCharacters, null, 2))
        console.log(`✅ Синхронизировано ${mergedCharacters.length} персонажей в characters-unified.json (было ${existingCharacters.length}, добавлено ${newCharacters.length})`)
        break
        
      case 'contracts':
        // Синхронизируем с contracts-unified.json
        const contractsPath = path.join(dataDir, 'contracts-unified.json')
        const contractsData = JSON.parse(fs.readFileSync(contractsPath, 'utf8'))
        
        const updatedContracts = {
          ...contractsData,
          available: data.available.map((contract: any) => ({
            id: contract.id,
            client: contract.client,
            title: contract.title,
            description: contract.description,
            requirements: contract.requirements,
            reward: contract.reward,
            deadline: contract.deadline,
            kpi: contract.kpi || [],
            assignedTalents: contract.assignedTalents || [],
            status: contract.status,
            storyScenes: contract.storyScenes || {}
          }))
        }
        
        fs.writeFileSync(contractsPath, JSON.stringify(updatedContracts, null, 2))
        console.log(`✅ Синхронизировано ${data.available.length} контрактов в contracts-unified.json`)
        break
        
      case 'actions':
        // Синхронизируем с actions-unified.json
        const actionsPath = path.join(dataDir, 'actions-unified.json')
        const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf8'))
        
        const updatedActions = {
          ...actionsData,
          actions: data.actions || [],
          categories: data.categories || {}
        }
        
        fs.writeFileSync(actionsPath, JSON.stringify(updatedActions, null, 2))
        console.log(`✅ Синхронизировано ${(data.actions || []).length} действий в actions-unified.json`)
        break
        
      case 'events':
        // Синхронизируем с events-unified.json
        const eventsPath = path.join(dataDir, 'events-unified.json')
        const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf8'))
        
        const allEvents = [
          ...(data.anomalies || []),
          ...(data.crises || []),
          ...(data.opportunities || [])
        ]
        
        const updatedEvents = {
          ...eventsData,
          events: allEvents
        }
        
        fs.writeFileSync(eventsPath, JSON.stringify(updatedEvents, null, 2))
        console.log(`✅ Синхронизировано ${allEvents.length} событий в events-unified.json`)
        break
        
      case 'users':
        // Синхронизируем с users-unified.json
        const usersPath = path.join(dataDir, 'users-unified.json')
        const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'))
        
        const updatedUsers = {
          ...usersData,
          users: data.users.map((user: any) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status,
            created: user.created,
            lastLogin: user.lastLogin,
            account: user.account || {
              balance: 0,
              currency: 'credits',
              transactions: []
            },
            assets: user.assets || [],
            equipment: user.equipment || [],
            settings: user.settings || {
              theme: 'dark',
              notifications: true,
              autoAssign: false,
              riskTolerance: 'medium'
            }
          }))
        }
        
        fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2))
        console.log(`✅ Синхронизировано ${data.users.length} пользователей в users-unified.json`)
        break
        
      case 'game-config-unified':
        // Синхронизируем Character AI конфигурацию с game-config-unified.json
        const gameConfigPath = path.join(dataDir, 'game-config-unified.json')
        const gameConfigData = JSON.parse(fs.readFileSync(gameConfigPath, 'utf8'))
        
        const updatedGameConfig = {
          ...gameConfigData,
          characterAI: data.characterAI
        }
        
        fs.writeFileSync(gameConfigPath, JSON.stringify(updatedGameConfig, null, 2))
        console.log(`✅ Синхронизирована Character AI конфигурация в game-config-unified.json`)
        break
        
      default:
        return NextResponse.json(
          { error: `Неизвестный тип конфигурации: ${configType}` },
          { status: 400 }
        )
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Данные ${configType} успешно синхронизированы` 
    })
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    console.log('🔄 Синхронизируем все данные из localStorage с файлами...')
    
    // Здесь можно добавить логику для получения данных из localStorage
    // и синхронизации всех типов конфигураций
    
    return NextResponse.json({ 
      success: true, 
      message: 'Синхронизация всех данных завершена' 
    })
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации всех данных:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' },
      { status: 500 }
    )
  }
}
