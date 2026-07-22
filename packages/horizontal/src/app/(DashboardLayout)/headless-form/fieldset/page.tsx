import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import MainFieldset from '@/app/components/headless-form/fieldset/MainFieldset'
import DisableFieldset from '@/app/components/headless-form/fieldset/DisableFieldset'

export const metadata: Metadata = {
  title: 'Headless Form Fieldset',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Fieldset',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Fieldset' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <MainFieldset />
        </div>
        <div className='col-span-12'>
          <DisableFieldset />
        </div>
      </div>
    </>
  )
}

export default page
