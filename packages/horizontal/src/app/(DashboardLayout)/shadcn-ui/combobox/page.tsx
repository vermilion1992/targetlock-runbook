import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicCombobox from '@/app/components/shadcn-ui/combobox/BasicCombobox'
import PopoverCombobox from '@/app/components/shadcn-ui/combobox/PopoverCombobox'
import DropdownCombobox from '@/app/components/shadcn-ui/combobox/DropdownCombobox'
import FormCombo from '@/app/components/shadcn-ui/combobox/FormCombo'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ui Combobox',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Combobox',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Combobox' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicCombobox />
        </div>
        <div className='col-span-12'>
          <PopoverCombobox />
        </div>
        <div className='col-span-12'>
          <DropdownCombobox />
        </div>
        <div className='col-span-12'>
          <FormCombo />
        </div>
      </div>
    </>
  )
}

export default page
