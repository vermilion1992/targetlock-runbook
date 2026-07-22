import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import DefaultSelect2 from '@/app/components/form-components/form-select2/DefaultSelect2'
import MultiSelect2 from '@/app/components/form-components/form-select2/MultiSelect2'

export const metadata: Metadata = {
  title: 'Form Select2',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Select2',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Select2' items={BCrumb} />
      <div className='flex flex-col gap-6'>
        <div>
            <DefaultSelect2 />
        </div>
        <div>
            <MultiSelect2 />
        </div>
      </div>
    </>
  )
}

export default page
