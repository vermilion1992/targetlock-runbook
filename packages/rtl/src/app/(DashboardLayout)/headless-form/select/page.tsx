import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicSelect from '@/app/components/headless-form/select/BasicSelect'
import WithLabelSelect from '@/app/components/headless-form/select/WithLabelSelect'
import WithDescriptionSelect from '@/app/components/headless-form/select/WithDescriptionSelect'
import DisabledSelect from '@/app/components/headless-form/select/DisableSelect'

export const metadata: Metadata = {
  title: 'Headless Form Select',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Select',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Select' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicSelect />
        </div>
        <div className='col-span-12'>
          <WithLabelSelect />
        </div>
        <div className='col-span-12'>
          <WithDescriptionSelect />
        </div>
        <div className='col-span-12'>
          <DisabledSelect />
        </div>
      </div>
    </>
  )
}

export default page
