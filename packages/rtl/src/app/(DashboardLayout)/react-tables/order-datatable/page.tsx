import OrderTable from '@/app/components/react-tables/order-datatable/page'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Order Table',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    to: '',
    title: 'Order Table',
  },
]

function page() {
  return (
    <>
      <BreadcrumbComp title='Order Table' items={BCrumb} />
      <OrderTable />
    </>
  )
}

export default page;
