// src/app/api/poses/[id]/modifiers/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { CreatePoseModifierRequest, PoseModifier } from '@/types/pose-formulas'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data: CreatePoseModifierRequest = await request.json()

    // Проверяем существование позы
    const pose = await prisma.poseDefinition.findUnique({
      where: { id }
    })

    if (!pose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Создаем новый модификатор
    const newModifier: PoseModifier = {
      id: `modifier_${Date.now()}`,
      type: data.type,
      target: data.target,
      formula: data.formula,
      description: data.description
    }

    // Получаем текущие модификаторы
    const currentEffects = (pose.effects as any) || {}
    const currentModifiers = currentEffects.modifiers || []

    // Добавляем новый модификатор
    const updatedModifiers = [...currentModifiers, newModifier]

    // Обновляем позу
    const updatedPose = await prisma.poseDefinition.update({
      where: { id },
      data: {
        effects: {
          ...currentEffects,
          modifiers: updatedModifiers
        } as any
      }
    })

    return NextResponse.json({
      success: true,
      modifier: newModifier,
      pose: updatedPose
    })
  } catch (error) {
    console.error('Error creating pose modifier:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const pose = await prisma.poseDefinition.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        effects: true
      }
    })

    if (!pose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Извлекаем модификаторы из effects
    const effects = (pose.effects as any) || {}
    const modifiers = effects.modifiers || []

    return NextResponse.json(modifiers)
  } catch (error) {
    console.error('Error fetching pose modifiers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
