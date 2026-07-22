import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import RadioGroupWithDesc from '@/app/components/headless-form/radiogroup/RadioGroupWithDesc'
import BasicRadioGroup from '@/app/components/headless-form/radiogroup/BasicRadioGroup'
import MainRadioGroup from '@/app/components/headless-form/radiogroup/MainRadioGroup'

import WithHtmlForms from '@/app/components/headless-form/radiogroup/WithHtmlForms'
import DisabledRadioGroup from '@/app/components/headless-form/radiogroup/DisabledRadioGroup'

export const metadata: Metadata = {
  title: 'Headless Form Radio Group',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'RadioGRoup',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Radio Group' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <MainRadioGroup />
        </div>
        <div className='col-span-12'>
          <RadioGroupWithDesc />
        </div>
        <div className='col-span-12'>
          <DisabledRadioGroup />
        </div>
        <div className='col-span-12'>
          <BasicRadioGroup />
        </div>
        <div className='col-span-12'>
          <WithHtmlForms />
        </div>
      </div>
    </>
  )
}

export default page
