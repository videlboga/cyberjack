// ===== РЕПОЗИТОРИЙ ПЕРСОНАЖЕЙ =====
// CRUD операции для работы с персонажами в БД

import { query, transaction, PoolClient } from '../client'
import type { Character, CharacterAttributes, CharacterStates } from '../../unified-entities'

export class CharactersRepository {
  // Получить всех персонажей
  async findAll(): Promise<Character[]> {
    const characters = await query<Character>(`
      SELECT
        id, name, rank, status, location, source, archetype,
        description, avatar, price, specialization, emotional_state,
        communication_style, created_at, last_interaction,
        total_interactions, metadata
      FROM characters
      ORDER BY created_at DESC
    `)

    // Загружаем связанные данные для каждого персонажа
    const charactersWithRelations = await Promise.all(
      characters.map(async (char) => {
        const [attributes, states, skills, fetishes] = await Promise.all([
          this.getAttributes(char.id),
          this.getStates(char.id),
          this.getSkills(char.id),
          this.getFetishes(char.id)
        ])

        return {
          ...char,
          attributes,
          states,
          skills,
          fetishes
        }
      })
    )

    return charactersWithRelations
  }

  // Получить персонажа по ID
  async findById(id: string): Promise<Character | null> {
    const characters = await query<Character>(`
      SELECT
        id, name, rank, status, location, source, archetype,
        description, avatar, price, specialization, emotional_state,
        communication_style, created_at, last_interaction,
        total_interactions, metadata
      FROM characters
      WHERE id = $1
    `, [id])

    if (characters.length === 0) return null

    const character = characters[0]
    const [attributes, states, skills, fetishes] = await Promise.all([
      this.getAttributes(id),
      this.getStates(id),
      this.getSkills(id),
      this.getFetishes(id)
    ])

    return {
      ...character,
      attributes,
      states,
      skills,
      fetishes
    }
  }

  // Создать нового персонажа
  async create(character: Omit<Character, 'id'>): Promise<Character> {
    return await transaction(async (client) => {
      // Генерируем ID если не указан
      const id = character.id || `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Создаем основную запись персонажа
      await client.query(`
        INSERT INTO characters (
          id, name, rank, status, location, source, archetype,
          description, avatar, price, specialization, emotional_state,
          communication_style, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        id, character.name, character.rank, character.status,
        character.location, character.source, character.archetype,
        character.description, character.avatar, character.price,
        character.specialization, character.emotionalState,
        character.communicationStyle, JSON.stringify(character.metadata || {})
      ])

      // Сохраняем атрибуты
      if (character.attributes) {
        await this.saveAttributes(client, id, character.attributes)
      }

      // Сохраняем состояния
      if (character.states) {
        await this.saveStates(client, id, character.states)
      }

      // Сохраняем навыки
      if (character.skills) {
        await this.saveSkills(client, id, character.skills)
      }

      // Сохраняем фетиши
      if (character.fetishes) {
        await this.saveFetishes(client, id, character.fetishes)
      }

      // Возвращаем созданного персонажа
      const created = await this.findById(id)
      if (!created) throw new Error('Не удалось создать персонажа')
      return created
    })
  }

  // Обновить персонажа
  async update(id: string, updates: Partial<Character>): Promise<Character> {
    return await transaction(async (client) => {
      // Обновляем основную запись
      const updateFields = []
      const updateValues = []
      let paramIndex = 1

      const allowedFields = [
        'name', 'rank', 'status', 'location', 'source', 'archetype',
        'description', 'avatar', 'price', 'specialization', 'emotional_state',
        'communication_style', 'metadata'
      ]

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`)
          updateValues.push(key === 'metadata' ? JSON.stringify(value) : value)
          paramIndex++
        }
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
        updateValues.push(id)

        await client.query(`
          UPDATE characters
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `, updateValues)
      }

      // Обновляем связанные данные
      if (updates.attributes) {
        await this.deleteAttributes(client, id)
        await this.saveAttributes(client, id, updates.attributes)
      }

      if (updates.states) {
        await this.deleteStates(client, id)
        await this.saveStates(client, id, updates.states)
      }

      if (updates.skills) {
        await this.deleteSkills(client, id)
        await this.saveSkills(client, id, updates.skills)
      }

      if (updates.fetishes) {
        await this.deleteFetishes(client, id)
        await this.saveFetishes(client, id, updates.fetishes)
      }

      // Возвращаем обновленного персонажа
      const updated = await this.findById(id)
      if (!updated) throw new Error('Не удалось обновить персонажа')
      return updated
    })
  }

  // Удалить персонажа
  async delete(id: string): Promise<boolean> {
    const result = await query(`
      DELETE FROM characters WHERE id = $1
    `, [id])

    return result.length > 0
  }

  // Получить атрибуты персонажа
  private async getAttributes(characterId: string): Promise<CharacterAttributes> {
    const attributes = await query(`
      SELECT category, attribute_name, value
      FROM character_attributes
      WHERE character_id = $1
    `, [characterId])

    const result: CharacterAttributes = {
      physical: {},
      psychological: {},
      social: {},
      personality: {},
      special: {}
    }

    for (const attr of attributes) {
      if (result[attr.category as keyof CharacterAttributes]) {
        result[attr.category as keyof CharacterAttributes][attr.attribute_name] = attr.value
      }
    }

    return result
  }

  // Сохранить атрибуты персонажа
  private async saveAttributes(
    client: PoolClient,
    characterId: string,
    attributes: CharacterAttributes
  ): Promise<void> {
    const values = []
    let paramIndex = 1

    for (const [category, attrs] of Object.entries(attributes)) {
      for (const [name, value] of Object.entries(attrs)) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
        paramIndex += 4
      }
    }

    if (values.length > 0) {
      const params = []
      for (const [category, attrs] of Object.entries(attributes)) {
        for (const [name, value] of Object.entries(attrs)) {
          params.push(characterId, category, name, value)
        }
      }

      await client.query(`
        INSERT INTO character_attributes (character_id, category, attribute_name, value)
        VALUES ${values.join(', ')}
      `, params)
    }
  }

  // Удалить атрибуты персонажа
  private async deleteAttributes(client: PoolClient, characterId: string): Promise<void> {
    await client.query(`
      DELETE FROM character_attributes WHERE character_id = $1
    `, [characterId])
  }

  // Получить состояния персонажа
  private async getStates(characterId: string): Promise<CharacterStates> {
    const states = await query(`
      SELECT state_name, value
      FROM character_states
      WHERE character_id = $1
    `, [characterId])

    const result: CharacterStates = {} as CharacterStates
    for (const state of states) {
      result[state.state_name as keyof CharacterStates] = state.value
    }

    return result
  }

  // Сохранить состояния персонажа
  private async saveStates(
    client: PoolClient,
    characterId: string,
    states: CharacterStates
  ): Promise<void> {
    const values = []
    const params = []
    let paramIndex = 1

    for (const [name, value] of Object.entries(states)) {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
      params.push(characterId, name, value)
      paramIndex += 3
    }

    if (values.length > 0) {
      await client.query(`
        INSERT INTO character_states (character_id, state_name, value)
        VALUES ${values.join(', ')}
      `, params)
    }
  }

  // Удалить состояния персонажа
  private async deleteStates(client: PoolClient, characterId: string): Promise<void> {
    await client.query(`
      DELETE FROM character_states WHERE character_id = $1
    `, [characterId])
  }

  // Получить навыки персонажа
  private async getSkills(characterId: string): Promise<Record<string, number>> {
    const skills = await query(`
      SELECT skill_name, level
      FROM character_skills
      WHERE character_id = $1
    `, [characterId])

    const result: Record<string, number> = {}
    for (const skill of skills) {
      result[skill.skill_name] = skill.level
    }

    return result
  }

  // Сохранить навыки персонажа
  private async saveSkills(
    client: PoolClient,
    characterId: string,
    skills: Record<string, number>
  ): Promise<void> {
    const values = []
    const params = []
    let paramIndex = 1

    for (const [name, level] of Object.entries(skills)) {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
      params.push(characterId, name, level)
      paramIndex += 3
    }

    if (values.length > 0) {
      await client.query(`
        INSERT INTO character_skills (character_id, skill_name, level)
        VALUES ${values.join(', ')}
      `, params)
    }
  }

  // Удалить навыки персонажа
  private async deleteSkills(client: PoolClient, characterId: string): Promise<void> {
    await client.query(`
      DELETE FROM character_skills WHERE character_id = $1
    `, [characterId])
  }

  // Получить фетиши персонажа
  private async getFetishes(characterId: string): Promise<Record<string, any>> {
    const fetishes = await query(`
      SELECT fetish_name, category, intensity
      FROM character_fetishes
      WHERE character_id = $1
    `, [characterId])

    const result: Record<string, any> = {
      primary: [],
      secondary: [],
      discovered: [],
      hidden: []
    }

    for (const fetish of fetishes) {
      if (result[fetish.category]) {
        if (fetish.intensity > 0) {
          result[fetish.category].push({
            name: fetish.fetish_name,
            intensity: fetish.intensity
          })
        } else {
          result[fetish.category].push(fetish.fetish_name)
        }
      }
    }

    return result
  }

  // Сохранить фетиши персонажа
  private async saveFetishes(
    client: PoolClient,
    characterId: string,
    fetishes: Record<string, any>
  ): Promise<void> {
    const values = []
    const params = []
    let paramIndex = 1

    for (const [category, fetishList] of Object.entries(fetishes)) {
      if (Array.isArray(fetishList)) {
        for (const fetish of fetishList) {
          const name = typeof fetish === 'string' ? fetish : fetish.name
          const intensity = typeof fetish === 'object' ? fetish.intensity || 0 : 0

          values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
          params.push(characterId, name, category, intensity)
          paramIndex += 4
        }
      }
    }

    if (values.length > 0) {
      await client.query(`
        INSERT INTO character_fetishes (character_id, fetish_name, category, intensity)
        VALUES ${values.join(', ')}
      `, params)
    }
  }

  // Удалить фетиши персонажа
  private async deleteFetishes(client: PoolClient, characterId: string): Promise<void> {
    await client.query(`
      DELETE FROM character_fetishes WHERE character_id = $1
    `, [characterId])
  }

  // Поиск персонажей по критериям
  async search(criteria: {
    rank?: string
    status?: string
    location?: string
    skills?: string[]
    limit?: number
    offset?: number
  }): Promise<Character[]> {
    let whereClause = 'WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (criteria.rank) {
      whereClause += ` AND rank = $${paramIndex}`
      params.push(criteria.rank)
      paramIndex++
    }

    if (criteria.status) {
      whereClause += ` AND status = $${paramIndex}`
      params.push(criteria.status)
      paramIndex++
    }

    if (criteria.location) {
      whereClause += ` AND location = $${paramIndex}`
      params.push(criteria.location)
      paramIndex++
    }

    if (criteria.skills && criteria.skills.length > 0) {
      whereClause += ` AND id IN (
        SELECT character_id FROM character_skills
        WHERE skill_name = ANY($${paramIndex})
      )`
      params.push(criteria.skills)
      paramIndex++
    }

    const limit = criteria.limit || 50
    const offset = criteria.offset || 0

    const characters = await query<Character>(`
      SELECT
        id, name, rank, status, location, source, archetype,
        description, avatar, price, specialization, emotional_state,
        communication_style, created_at, last_interaction,
        total_interactions, metadata
      FROM characters
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    // Загружаем связанные данные
    const charactersWithRelations = await Promise.all(
      characters.map(async (char) => {
        const [attributes, states, skills, fetishes] = await Promise.all([
          this.getAttributes(char.id),
          this.getStates(char.id),
          this.getSkills(char.id),
          this.getFetishes(char.id)
        ])

        return {
          ...char,
          attributes,
          states,
          skills,
          fetishes
        }
      })
    )

    return charactersWithRelations
  }
}

// Экспорт экземпляра репозитория
export const charactersRepository = new CharactersRepository()
