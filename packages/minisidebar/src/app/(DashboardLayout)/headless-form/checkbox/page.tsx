import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import WithLable from '@/app/components/headless-form/checkbox/WithLable'
import WithDescription from '@/app/components/headless-form/checkbox/WithDescription'
import DisableCheckBox from '@/app/components/headless-form/checkbox/DisableCheckBox'
import UsingHtmlForm from '@/app/components/headless-form/checkbox/UsingHtmlForm'
import UsingUncontrolled from '@/app/components/headless-form/checkbox/UsingUnctrolled'
import TransitionCheckbox from '@/app/components/headless-form/checkbox/TransitionCheckbox'
import RenderAsDiv from '@/app/components/headless-form/checkbox/RenderAsDiv'
import RenderAsProps from '@/app/components/headless-form/checkbox/RenderAsProps'

export const metadata: Metadata = {
  title: 'Headless Form Checkbox',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Checkbox',
  },
]

const page = () => {
  return (
    <div>
      <BreadcrumbComp title='Checkbox' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <WithLable />
        </div>
        <div className='col-span-12'>
          <WithDescription />
        </div>
        <div className='col-span-12'>
          <DisableCheckBox />
        </div>
        <div className='col-span-12'>
          <UsingHtmlForm />
        </div>
        <div className='col-span-12'>
          <UsingUncontrolled />
        </div>
        <div className='col-span-12'>
          <TransitionCheckbox />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <RenderAsDiv />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <RenderAsProps />
        </div>
      </div>
    </div>
  )
}

export default page
