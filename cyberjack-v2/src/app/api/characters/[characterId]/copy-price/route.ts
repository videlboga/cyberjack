// src/app/api/characters/[characterId]/copy-price/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { characterCopyPricingService } from '@/lib/core/pricing/character-copy-pricing'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const pricingResult = await characterCopyPricingService.calculateCopyPrice(
      characterId,
      userId
    )

    return NextResponse.json(pricingResult)
  } catch (error) {
    console.error('Error calculating character copy price:', error)
    return NextResponse.json(
      { error: 'Failed to calculate character copy price' },
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
    const { userId, characterIds } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Если передан массив ID персонажей, рассчитываем для всех
    if (characterIds && Array.isArray(characterIds)) {
      const results = await characterCopyPricingService.calculateMultipleCopyPrices(
        characterIds,
        userId
      )
      return NextResponse.json(results)
    }

    // Иначе рассчитываем для одного персонажа
    const pricingResult = await characterCopyPricingService.calculateCopyPrice(
      characterId,
      userId
    )

    return NextResponse.json(pricingResult)
  } catch (error) {
    console.error('Error calculating character copy prices:', error)
    return NextResponse.json(
      { error: 'Failed to calculate character copy prices' },
      { status: 500 }
    )
  }
}

