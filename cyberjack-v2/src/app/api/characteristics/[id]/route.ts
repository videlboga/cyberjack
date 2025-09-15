// app/api/characteristics/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔍 Fetching characteristic with ID:', id)

    if (!id) {
      return NextResponse.json(
        { error: 'Characteristic ID is required' },
        { status: 400 }
      )
    }

    // Получаем определение характеристики по ID
    const characteristic = await prisma.characteristicDefinition.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        category: true,
        description: true
      }
    })

    console.log('📊 Found characteristic:', characteristic)

    if (!characteristic) {
      return NextResponse.json(
        { error: 'Characteristic not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(characteristic)
  } catch (error) {
    console.error('❌ Error fetching characteristic:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
