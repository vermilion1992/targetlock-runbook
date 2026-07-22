import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import UserDataTable from '@/app/components/react-tables/user-datatable'

export const metadata: Metadata = {
  title: 'User Table',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    to: '',
    title: 'User Table',
  },
]

function page() {
  return (
    <>
      <BreadcrumbComp title='User Table' items={BCrumb} />
      <UserDataTable />
    </>
  )
}

export default page
