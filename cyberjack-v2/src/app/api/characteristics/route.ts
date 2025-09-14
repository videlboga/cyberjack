// app/api/characteristics/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const characteristics = await prisma.characteristicDefinition.findMany({
      where: {
        isActive: true,
        ...(category && { category })
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(characteristics)
  } catch (error) {
    console.error('Error fetching characteristics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characteristics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, description, minValue, maxValue } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Создаем определение характеристики
      const characteristic = await tx.characteristicDefinition.create({
        data: {
          name,
          category,
          description,
          minValue: minValue || 0,
          maxValue: maxValue || 100
        }
      })

      // Получаем всех активных персонажей
      const characters = await tx.character.findMany({
        where: { isActive: true }
      })

      // Создаем характеристики для всех персонажей
      if (characters.length > 0) {
        await tx.characteristic.createMany({
          data: characters.map(character => ({
            characterId: character.id,
            characteristicDefId: characteristic.id,
            currentValue: 50, // Значение по умолчанию
            baseValue: 50,
            recoveryRate: 1.0
          }))
        })
      }

      return characteristic
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to create characteristic' },
      { status: 500 }
    )
  }
}