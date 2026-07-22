import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicCommand from '@/app/components/shadcn-ui/command/BasicCommand'
import DialogCommand from '@/app/components/shadcn-ui/command/DialogCommand'

export const metadata: Metadata = {
  title: 'Ui Command',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Command',
  },
]
const page = () => {
  return (
    <div>
      <BreadcrumbComp title='Command' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicCommand />
        </div>
        <div className='col-span-12'>
          <DialogCommand />
        </div>
      </div>
    </div>
  )
}

export default page
