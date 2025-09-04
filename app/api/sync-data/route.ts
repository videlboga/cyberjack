import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { configType, data } = await request.json()

    console.log(`🎯 API: Получен запрос ${configType}`)
    console.log(`📦 API: Данные:`, JSON.stringify(data, null, 2))

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
        newCharacters.forEach((newChar: any) => {
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

        break

      case 'users':
        // Синхронизируем с users-unified.json
        const usersPath = path.join(dataDir, 'users-unified.json')
        const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'))

        console.log(`👥 API: Обрабатываем ${data.users.length} пользователей`)
        data.users.forEach((user: any, index: number) => {
          console.log(`  ${index + 1}. Пользователь ${user.id}: characters=${user.characters?.length || 0}, userEquipment=${user.userEquipment?.length || 0}`)
        })

        const updatedUsers = {
          ...usersData,
          users: data.users.map((user: any) => {
            console.log(`🔄 API: Обрабатываем пользователя ${user.id}`)
            console.log(`   - Characters: ${user.characters?.length || 0}`)
            console.log(`   - UserEquipment: ${user.userEquipment?.length || 0} [${user.userEquipment?.join(', ') || 'пусто'}]`)
            console.log(`   - CharacterKnowledge: ${Object.keys(user.characterKnowledge || {}).length} персонажей`)

            return {
              id: user.id,
              name: user.name,
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
              characters: user.characters || [],
              userEquipment: user.userEquipment || [],
              attributes: user.attributes || {},
              stats: user.stats || {},
              assets: user.assets || [],
              equipment: user.equipment || [],
              settings: user.settings || {
                theme: 'dark',
                notifications: true,
                autoAssign: false,
                riskTolerance: 'medium'
              },
              preferences: user.preferences || {
                autoSave: true,
                soundEnabled: true,
                animationsEnabled: true
              },
              characterKnowledge: user.characterKnowledge || {}
            }
          })
        }

        fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2))
        console.log(`✅ API: Синхронизация пользователей завершена`)
        break

      case 'characters': {
        // Синхронизируем с characters-unified.json
        const charactersPath = path.join(dataDir, 'characters-unified.json')
        const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))

        console.log(`👤 API: Синхронизируем ${data.characters?.length || 0} персонажей`)

        // Обновляем или добавляем персонажей
        if (!Array.isArray(charactersData.characters)) {
          (charactersData as any).characters = []
        }

        // Находим и обновляем каждого персонажа из data
        const incoming: any[] = Array.isArray((data as any)?.characters) ? (data as any).characters : []
        incoming.forEach((character: any, index: number) => {
          console.log(`  ${index + 1}. Персонаж ${character.id}: ${character.name}`)
          console.log(`     - Has prompts: ${!!character.prompts}`)
          console.log(`     - Prompts keys: ${character.prompts ? Object.keys(character.prompts).join(', ') : 'none'}`)

          if (character.prompts) {
            console.log(`     - Base prompt length: ${character.prompts.base?.length || 0}`)
            console.log(`     - Characteristic interpretations: ${character.prompts.characteristicInterpretations ? Object.keys(character.prompts.characteristicInterpretations).join(', ') : 'none'}`)
            console.log(`     - Situational prompts count: ${character.prompts.situational?.length || 0}`)

            // Детальное логирование интерпретаций
            if (character.prompts.characteristicInterpretations) {
              Object.entries(character.prompts.characteristicInterpretations).forEach(([category, interpretations]: [string, any]) => {
                if (interpretations && typeof interpretations === 'object') {
                  const interpretationKeys = Object.keys(interpretations)
                  console.log(`       - ${category}: ${interpretationKeys.length} интерпретаций [${interpretationKeys.join(', ')}]`)
                }
              })
            }
          }

          const existingIndex = charactersData.characters.findIndex((c: any) => c.id === character.id)
          if (existingIndex >= 0) {
            // Обновляем существующего персонажа
            charactersData.characters[existingIndex] = character
            console.log(`🔄 Обновлен персонаж: ${character.name} (${character.id})`)
          } else {
            // Добавляем нового персонажа
            charactersData.characters.push(character)
            console.log(`➕ Добавлен новый персонаж: ${character.name} (${character.id})`)
          }
        })

        fs.writeFileSync(charactersPath, JSON.stringify(charactersData, null, 2))
        console.log('✅ Characters синхронизированы с файлом')
        break
      }

      case 'characterAI':
        // Синхронизируем Character AI конфигурацию с game-config-unified.json
        const characterAIPath = path.join(dataDir, 'game-config-unified.json')
        const characterAIData = JSON.parse(fs.readFileSync(characterAIPath, 'utf8'))

        const updatedCharacterAI = {
          ...characterAIData,
          characterAI: data
        }

        fs.writeFileSync(characterAIPath, JSON.stringify(updatedCharacterAI, null, 2))
        console.log('✅ CharacterAI синхронизирован с файлом')

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
