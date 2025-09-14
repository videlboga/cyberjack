// src/app/api/poses/[id]/conditions/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { CreatePoseConditionRequest, PoseCondition } from '@/types/pose-formulas'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Временно убираем авторизацию для тестирования
    // const session = await getServerSession(authOptions)
    // if (!session?.user || session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { id } = await params
    const data: CreatePoseConditionRequest = await request.json()

    // Проверяем существование позы
    const pose = await prisma.poseDefinition.findUnique({
      where: { id }
    })

    if (!pose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Создаем новое условие
    const newCondition: PoseCondition = {
      id: `condition_${Date.now()}`,
      type: data.type,
      target: data.target,
      operator: data.operator,
      value: data.value,
      description: data.description
    }

    // Получаем текущие условия
    const currentRequirements = (pose.requirements as any) || {}
    const currentConditions = currentRequirements.conditions || []

    // Добавляем новое условие
    const updatedConditions = [...currentConditions, newCondition]

    // Обновляем позу
    const updatedPose = await prisma.poseDefinition.update({
      where: { id },
      data: {
        requirements: {
          ...currentRequirements,
          conditions: updatedConditions
        } as any
      }
    })

    return NextResponse.json({
      success: true,
      condition: newCondition,
      pose: updatedPose
    })
  } catch (error) {
    console.error('Error creating pose condition:', error)
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
    // Временно убираем авторизацию для тестирования
    // const session = await getServerSession(authOptions)
    // if (!session?.user || session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { id } = await params

    const pose = await prisma.poseDefinition.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        requirements: true
      }
    })

    if (!pose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Извлекаем условия из requirements
    const requirements = (pose.requirements as any) || {}
    const conditions = requirements.conditions || []

    return NextResponse.json(conditions)
  } catch (error) {
    console.error('Error fetching pose conditions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
