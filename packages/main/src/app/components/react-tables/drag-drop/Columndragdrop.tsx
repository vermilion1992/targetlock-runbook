'use client'
import React, { CSSProperties } from 'react'
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  Header,
  Cell,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import TitleIconCard from '@/app/components/shared/TitleIconCard'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BadgeProps } from '@/components/ui/badge'
import { GripVertical } from 'lucide-react'

export interface ColTableType {
  id?: string
  avatar?: string
  name?: string
  handle?: string
  courses: {
    status: string
    statuscolor: string
  }[]
  users?: string
  actions?: string
  description: string
}

const basicTableData: ColTableType[] = [
  {
    avatar: '/images/blog/blog-img1.jpg',
    name: 'Top Authors',
    handle: 'Successful Fellas',
    users: '4300 Users',
    courses: [
      {
        status: 'Angular',
        statuscolor: 'lightError',
      },
      {
        status: 'PHP',
        statuscolor: 'lightPrimary',
      },
    ],
    description: 'A popular theme with various features.',
  },
  {
    avatar: '/images/blog/blog-img2.jpg',
    name: 'Popular Authors',
    handle: 'Most Successful',
    users: '1200 Users',
    courses: [
      {
        status: 'Bootstrap',
        statuscolor: 'lightPrimary',
      },
    ],
    description: 'A popular theme with various features.',
  },
  {
    avatar: '/images/blog/blog-img3.jpg',
    name: 'New Users',
    handle: 'Awesome Users',
    users: '2000 Users',
    courses: [
      {
        status: 'Reactjs',
        statuscolor: 'lightSuccess',
      },
      {
        status: 'Angular',
        statuscolor: 'lightError',
      },
    ],
    description: 'A popular theme with various features.',
  },
  {
    avatar: '/images/blog/blog-img4.jpg',
    name: 'Active Customers',
    handle: 'Best Customers',
    users: '1500 Users',
    courses: [
      {
        status: 'Bootstrap',
        statuscolor: 'lightPrimary',
      },
    ],
    description: 'A popular theme with various features.',
  },
  {
    avatar: '/images/blog/blog-img5.jpg',
    name: 'Bestseller Theme',
    handle: 'Amazing Templates',
    users: '9500 Users',
    courses: [
      {
        status: 'Angular',
        statuscolor: 'lightError',
      },
      {
        status: 'Reactjs',
        statuscolor: 'lightSuccess',
      },
    ],
    description: 'A popular theme with various features.',
  },
]

const columnHelper = createColumnHelper<ColTableType>()

const columns = [
  columnHelper.accessor('avatar', {
    id: 'avatar',
    cell: (info) => (
      <div className='flex gap-3 items-center'>
        <Image
          src={info.getValue() || ''}
          width={50}
          height={50}
          alt='icon'
          className='h-10 w-10 rounded-md'
        />
        <div className='truncate line-clamp-2 max-w-56'>
          <h6 className='text-base'>{info.row.original.name}</h6>
          <p className='text-sm text-darklink dark:text-bodytext'>
            {info.row.original.handle}
          </p>
        </div>
      </div>
    ),
    header: () => <span>Authors</span>,
  }),
  columnHelper.accessor('courses', {
    id: 'courses',
    cell: (info) => (
      <div className='flex gap-2'>
        {info.getValue().map((course, index) => (
          <Badge
            key={index}
            variant={course.statuscolor as BadgeProps['variant']}
            className='capitalize'>
            {course.status}
          </Badge>
        ))}
      </div>
    ),
    header: () => <span>Courses</span>,
  }),
  columnHelper.accessor('users', {
    id: 'users',
    cell: (info) => (
      <p className='text-darklink dark:text-bodytext text-sm'>
        {info.getValue()}
      </p>
    ),
    header: () => <span>Users</span>,
  }),

  columnHelper.accessor('description', {
    id: 'description',
    cell: (info) => (
      <p className='text-darklink dark:text-bodytext text-sm'>
        {info.getValue()}
      </p>
    ),
    header: () => <span>Description</span>,
  }),
]

const DraggableTableHeader = ({ header }: { header: Header<ColTableType, any> }) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.id,
    })

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition: 'width transform 0.2s ease-in-out',
    whiteSpace: 'nowrap',
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className='text-base text-ld font-semibold py-3 text-left border-b border-ld px-4'>
      <div className='flex items-center gap-2'>
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        <button {...attributes} {...listeners}>
          <GripVertical className='cursor-grab' size={18} />
        </button>
      </div>
    </th>
  )
}

const DragAlongCell = ({ cell }: { cell: Cell<ColTableType, any> }) => {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: cell.column.id,
  })

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition: 'width transform 0.2s ease-in-out',
    width: cell.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <td style={style} ref={setNodeRef} className='whitespace-nowrap py-3 px-4'>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  )
}
function Columndragdrop() {
  const [data] = React.useState(() => [...basicTableData])
  const [columnOrder, setColumnOrder] = React.useState<string[]>(
    columns.map((c) => c.id!)
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder,
    },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    debugColumns: true,
    debugTable: true,
    debugHeaders: true,
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string)
        const newIndex = columnOrder.indexOf(over.id as string)
        return arrayMove(columnOrder, oldIndex, newIndex)
      })
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const handleDownload = () => {
    const headers = ['Name', 'Handle', 'Users', 'Courses', 'Desciption']
    const rows = data.map((item) => [
      item.name,
      item.handle,
      item.users,
      item.courses.map((course) => course.status).join(', '),
      item.description,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((e) => e.join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'table-data.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}>
      <TitleIconCard
        title='Column Drag & Drop Table'
        onDownload={handleDownload}>
        <div className='border rounded-md border-ld overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='min-w-full'>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    <SortableContext
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}>
                      {headerGroup.headers.map((header) => (
                        <DraggableTableHeader key={header.id} header={header} />
                      ))}
                    </SortableContext>
                  </tr>
                ))}
              </thead>
              <tbody className='divide-y divide-border dark:divide-darkborder'>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <SortableContext
                        key={cell.id}
                        items={columnOrder}
                        strategy={horizontalListSortingStrategy}>
                        <DragAlongCell key={cell.id} cell={cell} />
                      </SortableContext>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TitleIconCard>
    </DndContext>
  )
}
export default Columndragdrop
