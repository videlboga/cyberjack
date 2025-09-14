import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  try {
    const characters = await prisma.character.findMany({
      include: {
        characteristics: {
          include: {
            definition: true
          }
        },
        anatomy: {
          include: {
            definition: true
          }
        },
        poses: {
          include: {
            definition: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(characters)
  } catch (error) {
    console.error('Error fetching characters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characters' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, age, avatar, isActive = true } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Создаем персонажа
      const character = await tx.character.create({
        data: {
          name,
          description,
          age,
          avatar,
          isActive
        }
      })

      // Получаем все активные определения характеристик
      const characteristicDefinitions = await tx.characteristicDefinition.findMany({
        where: { isActive: true }
      })

      // Создаем характеристики для персонажа
      if (characteristicDefinitions.length > 0) {
        await tx.characteristic.createMany({
          data: characteristicDefinitions.map(def => ({
            characterId: character.id,
            characteristicDefId: def.id,
            currentValue: 50, // Значение по умолчанию
            baseValue: 50,
            recoveryRate: 1.0
          }))
        })
      }

      return character
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating character:', error)
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    )
  }
}
