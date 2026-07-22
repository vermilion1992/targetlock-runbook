import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicTab from '@/app/components/shadcn-ui/tab/BasicTab'

export const metadata: Metadata = {
  title: 'Ui Tab',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Tab',
  },
]
const page = () => {
  return (
    <>
      <BreadcrumbComp title='Tab' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicTab />
        </div>
      </div>
    </>
  )
}

export default page
