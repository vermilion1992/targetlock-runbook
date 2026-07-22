import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicButton from '@/app/components/shadcn-ui/button/BasicButton'
import OutlineButton from '@/app/components/shadcn-ui/button/OutlineButton'
import GhostButton from '@/app/components/shadcn-ui/button/GhostButton'
import ButtonWithIcon from '@/app/components/shadcn-ui/button/ButtonWithIcon'
import LoadingButton from '@/app/components/shadcn-ui/button/LoadingButton'

export const metadata: Metadata = {
  title: 'Ui Button',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Button',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Button' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicButton />
        </div>
        <div className='col-span-12'>
          <OutlineButton />
        </div>
        <div className='col-span-12'>
          <GhostButton />
        </div>
        <div className='col-span-12'>
          <ButtonWithIcon />
        </div>
        <div className='col-span-12'>
          <LoadingButton />
        </div>
      </div>
    </>
  )
}

export default page
