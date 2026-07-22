import { NextResponse } from 'next/server'
import { KanbanData } from '../../../components/apps/kanban/kanban-data'
import { Task } from '@/app/(DashboardLayout)/types/apps/kanban'

export async function PATCH(req: Request) {
  try {
    const { taskId, newData } = (await req.json()) as {
      taskId: string | number
      newData: Partial<Task>
    }
    KanbanData.forEach((category) => {
      category.child.forEach((task) => {
        if (task.id === taskId) {
          Object.assign(task, newData)
        }
      })
    })
    return NextResponse.json({ status: 200, msg: 'success', data: KanbanData })
  } catch (error: unknown) {
    return NextResponse.json({
      status: 400,
      msg: 'Internal server error',
      error,
    })
  }
}
