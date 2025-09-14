// src/app/api/poses/[id]/formulas/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PoseFormulas } from '@/types/pose-formulas'

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
        effects: true,
        requirements: true
      }
    })

    if (!pose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Парсим существующие формулы из JSON полей
    const formulas: PoseFormulas = {
      conditions: [],
      effects: [],
      modifiers: []
    }

    // Если есть requirements, парсим их как условия
    if (pose.requirements && typeof pose.requirements === 'object') {
      const requirements = pose.requirements as any
      if (requirements.conditions && Array.isArray(requirements.conditions)) {
        formulas.conditions = requirements.conditions
      }
    }

    // Если есть effects, парсим их как эффекты
    if (pose.effects && typeof pose.effects === 'object') {
      const effects = pose.effects as any
      if (effects.effects && Array.isArray(effects.effects)) {
        formulas.effects = effects.effects
      }
      if (effects.modifiers && Array.isArray(effects.modifiers)) {
        formulas.modifiers = effects.modifiers
      }
    }

    return NextResponse.json(formulas)
  } catch (error) {
    console.error('Error fetching pose formulas:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const formulas: PoseFormulas = await request.json()

    // Валидация формул
    const validation = validatePoseFormulas(formulas)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid formulas', details: validation.errors },
        { status: 400 }
      )
    }

    // Проверяем существование позы
    const existingPose = await prisma.poseDefinition.findUnique({
      where: { id }
    })

    if (!existingPose) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 })
    }

    // Обновляем позу с новыми формулами
    const updatedPose = await prisma.poseDefinition.update({
      where: { id },
      data: {
        requirements: {
          conditions: formulas.conditions
        } as any,
        effects: {
          effects: formulas.effects,
          modifiers: formulas.modifiers
        } as any
      }
    })

    return NextResponse.json({
      success: true,
      pose: updatedPose
    })
  } catch (error) {
    console.error('Error updating pose formulas:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Валидация формул поз
function validatePoseFormulas(formulas: PoseFormulas) {
  const errors: string[] = []

  // Валидация условий
  formulas.conditions.forEach((condition, index) => {
    if (!condition.id) {
      errors.push(`Condition ${index}: missing id`)
    }
    if (!condition.type) {
      errors.push(`Condition ${index}: missing type`)
    }
    if (!condition.target) {
      errors.push(`Condition ${index}: missing target`)
    }
    if (!condition.operator) {
      errors.push(`Condition ${index}: missing operator`)
    }
    if (condition.value === undefined || condition.value === null) {
      errors.push(`Condition ${index}: missing value`)
    }
  })

  // Валидация эффектов
  formulas.effects.forEach((effect, index) => {
    if (!effect.id) {
      errors.push(`Effect ${index}: missing id`)
    }
    if (!effect.type) {
      errors.push(`Effect ${index}: missing type`)
    }
    if (!effect.target) {
      errors.push(`Effect ${index}: missing target`)
    }
    if (!effect.formula) {
      errors.push(`Effect ${index}: missing formula`)
    }
    if (!effect.frequency) {
      errors.push(`Effect ${index}: missing frequency`)
    }
  })

  // Валидация модификаторов
  formulas.modifiers.forEach((modifier, index) => {
    if (!modifier.id) {
      errors.push(`Modifier ${index}: missing id`)
    }
    if (!modifier.type) {
      errors.push(`Modifier ${index}: missing type`)
    }
    if (!modifier.target) {
      errors.push(`Modifier ${index}: missing target`)
    }
    if (!modifier.formula) {
      errors.push(`Modifier ${index}: missing formula`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}
