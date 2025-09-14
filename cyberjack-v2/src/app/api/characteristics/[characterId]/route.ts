// app/api/characteristics/[characterId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const characteristics = await prisma.characteristic.findMany({
      where: { characterId },
      include: {
        definition: true
      }
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const body = await request.json()
    const { characteristicDefId, currentValue, baseValue, recoveryRate } = body

    const characteristic = await prisma.characteristic.create({
      data: {
        characterId,
        characteristicDefId,
        currentValue,
        baseValue,
        recoveryRate: recoveryRate || 1.0
      },
      include: {
        definition: true
      }
    })

    return NextResponse.json(characteristic)
  } catch (error) {
    console.error('Error creating characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to create characteristic' },
      { status: 500 }
    )
  }
}