import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicCollapse from '@/app/components/shadcn-ui/collapsible/BasicCollapse'
import AdvanceCollapse from '@/app/components/shadcn-ui/collapsible/AdvanceCollapse'

export const metadata: Metadata = {
  title: 'Ui Collapsible',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Collapsible',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Collapsible' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicCollapse />
        </div>
        <div className='col-span-12'>
          <AdvanceCollapse />
        </div>
      </div>
    </>
  )
}

export default page
