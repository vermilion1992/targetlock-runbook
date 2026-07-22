import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicDatepicker from '@/app/components/shadcn-ui/datepicker/BasicDatepicker'
import DateRangePicker from '@/app/components/shadcn-ui/datepicker/DateRangePicker'

export const metadata: Metadata = {
  title: 'Ui Datepicker',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Datepicker',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Datepicker' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicDatepicker />
        </div>
        <div className='col-span-12'>
          <DateRangePicker />
        </div>
      </div>
    </>
  )
}

export default page
