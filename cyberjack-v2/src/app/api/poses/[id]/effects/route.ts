// src/app/api/poses/[id]/effects/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { CreatePoseEffectRequest, PoseEffect } from '@/types/pose-formulas'

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
    const data: CreatePoseEffectRequest = await request.json()

    // Проверяем существование позы
    const pose = await prisma.poseDefinition.findUnique({
      where: { id }
    })

    if (!pose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Создаем новый эффект
    const newEffect: PoseEffect = {
      id: `effect_${Date.now()}`,
      type: data.type,
      target: data.target,
      formula: data.formula,
      frequency: data.frequency,
      description: data.description
    }

    // Получаем текущие эффекты
    const currentEffects = (pose.effects as any) || {}
    const currentEffectsList = currentEffects.effects || []

    // Добавляем новый эффект
    const updatedEffects = [...currentEffectsList, newEffect]

    // Обновляем позу
    const updatedPose = await prisma.poseDefinition.update({
      where: { id },
      data: {
        effects: {
          ...currentEffects,
          effects: updatedEffects
        } as any
      }
    })

    return NextResponse.json({
      success: true,
      effect: newEffect,
      pose: updatedPose
    })
  } catch (error) {
    console.error('Error creating pose effect:', error)
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

    // Извлекаем эффекты из effects
    const effects = (pose.effects as any) || {}
    const effectsList = effects.effects || []

    return NextResponse.json(effectsList)
  } catch (error) {
    console.error('Error fetching pose effects:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
