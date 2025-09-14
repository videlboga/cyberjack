// src/app/api/poses/[id]/activate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PoseFormulaSystem } from '@/lib/core/poses/pose-formula-system'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Временно убираем авторизацию для тестирования
    // const session = await getServerSession(authOptions)
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { id: poseId } = await params
    const { characterId } = await request.json()

    if (!characterId) {
      return NextResponse.json(
        { error: 'Character ID is required' },
        { status: 400 }
      )
    }

    const poseSystem = new PoseFormulaSystem()
    const status = await poseSystem.activatePose(poseId, characterId, 'system')

    return NextResponse.json({
      success: true,
      status
    })
  } catch (error) {
    console.error('Error activating pose:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Временно убираем авторизацию для тестирования
    // const session = await getServerSession(authOptions)
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { id: poseId } = await params
    const { characterId } = await request.json()

    if (!characterId) {
      return NextResponse.json(
        { error: 'Character ID is required' },
        { status: 400 }
      )
    }

    const poseSystem = new PoseFormulaSystem()
    const status = await poseSystem.deactivatePose(poseId, characterId, 'system')

    return NextResponse.json({
      success: true,
      status
    })
  } catch (error) {
    console.error('Error deactivating pose:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
