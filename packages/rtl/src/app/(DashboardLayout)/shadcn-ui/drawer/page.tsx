import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicDrawer from '@/app/components/shadcn-ui/drawer/BasicDrawer'

export const metadata: Metadata = {
  title: 'Ui Drawer',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Drawer',
  },
]
const page = () => {
  return (
    <>
      <BreadcrumbComp title='Drawer' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          {/* <BasicDropdown /> */}
          <BasicDrawer />
        </div>
      </div>
    </>
  )
}

export default page
