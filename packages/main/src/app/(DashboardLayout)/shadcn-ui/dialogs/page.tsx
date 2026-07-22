import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicDialog from '@/app/components/shadcn-ui/dialog/BasicDialog'
import DialogWithCustomCloseButton from '@/app/components/shadcn-ui/dialog/DialogWithCustomCloseButton'
import DialogWithForm from '@/app/components/shadcn-ui/dialog/DialogWithForm'

export const metadata: Metadata = {
  title: 'Ui Dialog',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Dialog',
  },
]
const page = () => {
  return (
    <>
      <BreadcrumbComp title='Dialog' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicDialog />
        </div>
        <div className='col-span-12'>
          <DialogWithCustomCloseButton />
        </div>
        <div className='col-span-12'>
          <DialogWithForm />
        </div>
      </div>
    </>
  )
}

export default page
