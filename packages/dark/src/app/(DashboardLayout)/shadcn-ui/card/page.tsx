import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicCard from '@/app/components/shadcn-ui/card/BasicCard'
import FormCard from '@/app/components/shadcn-ui/card/FormCard'
import NotificationCard from '@/app/components/shadcn-ui/card/NotificationCard'
import ChartCard from '@/app/components/shadcn-ui/card/ChartCard'

export const metadata: Metadata = {
  title: 'Ui Card',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Card',
  },
]
const page = () => {
  return (
    <>
      <BreadcrumbComp title='Card' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicCard />
        </div>
        <div className='col-span-12'>
          <FormCard />
        </div>
        <div className='col-span-12'>
          <NotificationCard />
        </div>
        <div className='col-span-12'>
          <ChartCard />
        </div>
      </div>
    </>
  )
}

export default page
