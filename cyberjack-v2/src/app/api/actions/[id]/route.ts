// app/api/actions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '../../../../../lib/core/actions/actions-system'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actionsSystem = new ActionsSystem()
    const actions = await actionsSystem.getAllActions()
    const action = actions.find(a => a.id === params.id)

    if (!action) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(action)
  } catch (error) {
    console.error('Error fetching action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch action' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updateData = await request.json()

    const actionsSystem = new ActionsSystem()
    const action = await actionsSystem.updateAction(params.id, updateData)

    return NextResponse.json(action)
  } catch (error) {
    console.error('Error updating action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update action' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actionsSystem = new ActionsSystem()
    await actionsSystem.deleteAction(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete action' },
      { status: 500 }
    )
  }
}
