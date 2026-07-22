import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicSkeleton from '@/app/components/shadcn-ui/skeleton/BasicSkeleton'
import CardSkeleton from '@/app/components/shadcn-ui/skeleton/CardSkeleton'

export const metadata: Metadata = {
  title: 'Ui Skeleton',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Skeleton',
  },
]
const page = () => {
  return (
    <>
      <BreadcrumbComp title='Skeleton' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicSkeleton />
        </div>
        <div className='col-span-12'>
          <CardSkeleton />
        </div>
      </div>
    </>
  )
}

export default page
