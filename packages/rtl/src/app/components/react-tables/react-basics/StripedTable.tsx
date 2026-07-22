'use client'
import React from 'react'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import Image from 'next/image'
import { IconDots } from '@tabler/icons-react'
import { Icon } from '@iconify/react'
import TitleIconCard from '../../shared/TitleIconCard'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

export interface TableType3 {
  avatar?: string
  name?: string
  post?: string
  users: {
    id: string
    icon: string
  }[]
  status?: string | any
  statuscolor?: string
  budget?: string
  actions?: string
}

const basicTableData2: TableType3[] = [
  {
    avatar: '/images/profile/user-1.jpg',
    name: 'Olivia Rhye',
    post: 'Xtreme admin',
    status: 'active',
    statuscolor: 'lightError',

    users: [
      { id: '1', icon: '/images/profile/user-2.jpg' },
      { id: '2', icon: '/images/profile/user-3.jpg' },
    ],
  },
  {
    avatar: '/images/profile/user-8.jpg',
    name: 'Barbara Steele',
    post: 'Adminpro admin',
    status: 'cancel',
    statuscolor: 'lightError',
    users: [
      { id: '1', icon: '/images/profile/user-3.jpg' },
      { id: '2', icon: '/images/profile/user-2.jpg' },
      { id: '3', icon: '/images/profile/user-1.jpg' },
    ],
  },
  {
    avatar: '/images/profile/user-3.jpg',
    name: 'Leonard Gordon',
    post: 'Monster admin',
    status: 'active',
    statuscolor: 'lightPrimary',
    users: [
      {
        id: '1',
        icon: '/images/profile/user-2.jpg',
      },
      {
        id: '2',
        icon: '/images/profile/user-3.jpg',
      },
    ],
  },
  {
    avatar: '/images/profile/user-3.jpg',
    name: 'Evelyn Pope',
    post: 'matdashpro admin',
    status: 'pending',
    statuscolor: 'lightSuccess',
    users: [
      {
        id: '1',
        icon: '/images/profile/user-3.jpg',
      },
      {
        id: '2',
        icon: '/images/profile/user-2.jpg',
      },
      {
        id: '3',
        icon: '/images/profile/user-1.jpg',
      },
    ],
  },
  {
    avatar: '/images/profile/user-5.jpg',
    name: 'Tommy Garza',
    post: 'Elegant admin',
    status: 'cancel',
    statuscolor: 'lightError',
    users: [
      {
        id: '1',
        icon: '/images/profile/user-6.jpg',
      },
      {
        id: '2',
        icon: '/images/profile/user-5.jpg',
      },
    ],
  },
  {
    avatar: '/images/profile/user-9.jpg',
    name: 'Isabel Vasquez',
    post: 'TailwindAdmin admin',
    status: 'pending',
    statuscolor: 'lightPrimary',
    users: [
      {
        id: '1',
        icon: '/images/profile/user-4.jpg',
      },
      {
        id: '2',
        icon: '/images/profile/user-2.jpg',
      },
    ],
  },
]

const statusColorMapping: { [key: string]: string } = {
  active: 'lightPrimary',
  cancel: 'lightError',
  pending: 'lightSuccess',
  default: 'default',
}

const columnHelper = createColumnHelper<TableType3>()

const columns = [
  columnHelper.accessor('avatar', {
    cell: (info) => (
      <div className='flex gap-3 items-center'>
        <Image
          src={info.getValue() || '/path/to/default-avatar.jpg'}
          width={50}
          height={50}
          alt='avatar'
          className='h-10 w-10 rounded-full'
        />
        <div className='truncate line-clamp-2 sm:max-w-56'>
          <h6 className='text-base'>{info.row.original.name}</h6>
        </div>
      </div>
    ),
    header: () => <span>User</span>,
  }),
  columnHelper.accessor('post', {
    header: () => <span>Project Name</span>,
    cell: (info) => (
      <p className='text-darklink dark:text-bodytext text-base'>
        {info.getValue()}
      </p>
    ),
  }),
  columnHelper.accessor('users', {
    header: () => <span>Users</span>,
    cell: (info) => (
      <div className='flex'>
        {info.getValue().map((user) => (
          <div className='-ms-2' key={user.id}>
            <Image
              src={user.icon || '/images/profile/user-1.jpg'}
              width={50}
              height={50}
              className='border-2 border-white dark:border-darkborder rounded-full h-10 w-10 max-w-none'
              alt='user icon'
            />
          </div>
        ))}
      </div>
    ),
  }),
  columnHelper.accessor('status', {
    header: () => <span>Status</span>,
    cell: (info) => (
      <Badge
        variant={
          (statusColorMapping[info.getValue()] as BadgeProps['variant']) ||
          'default'
        }
        className='capitalize'>
        {info.getValue()}
      </Badge>
    ),
  }),

  columnHelper.accessor('actions', {
    header: () => <span></span>,
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className='h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer'>
            <IconDots size={22} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-40'>
          {[
            { icon: 'solar:add-circle-outline', listtitle: 'Add' },
            { icon: 'solar:pen-new-square-broken', listtitle: 'Edit' },
            {
              icon: 'solar:trash-bin-minimalistic-outline',
              listtitle: 'Delete',
            },
          ].map((item, index) => (
            <DropdownMenuItem
              key={index}
              className='flex items-center gap-3 cursor-pointer'>
              <Icon icon={item.icon} height={18} />
              <span>{item.listtitle}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
]

const StripedTable = () => {
  const [data] = React.useState(() => [...basicTableData2])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleDownload = () => {
    const headers = ['Name', 'post', 'status', 'users']
    const rows = data.map((item) => [
      item.name,
      item.post,
      item.status,
      item.users.map((items) => items.id).join(', '),
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
    <TitleIconCard title='Striped Row Table' onDownload={handleDownload}>
      <div className='border rounded-md border-ld overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full'>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className='text-base text-ld font-semibold  text-left border-b border-ld px-4 py-3'>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className='divide-y divide-border dark:divide-darkborder'>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className='odd:bg-transparent even:bg-lightprimary dark:even:bg-lightprimary'>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className='whitespace-nowrap py-3 px-4'>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TitleIconCard>
  )
}

export default StripedTable
