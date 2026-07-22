import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicTextarea from '@/app/components/headless-form/textarea/BasicTextarea'
import WithLabelTextarea from '@/app/components/headless-form/textarea/WithLabel'
import WithDescriptionTextarea from '@/app/components/headless-form/textarea/WithDescriptionTextarea'
import DisableTextarea from '@/app/components/headless-form/textarea/DisableTextArea'

export const metadata: Metadata = {
  title: 'Headless Form Textarea',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Textarea',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Textarea' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicTextarea />
        </div>
        <div className='col-span-12'>
          <WithLabelTextarea />
        </div>
        <div className='col-span-12'>
          <WithDescriptionTextarea />
        </div>
        <div className='col-span-12'>
          <DisableTextarea />
        </div>
      </div>
    </>
  )
}

export default page
