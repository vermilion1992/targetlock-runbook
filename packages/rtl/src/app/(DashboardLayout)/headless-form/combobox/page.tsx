import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicComobobox from '@/app/components/headless-form/combobox/BasicComobobox'
import WithLabel from '@/app/components/headless-form/combobox/WithLabel'
import DisableCombo from '@/app/components/headless-form/combobox/Disable'
import DisableComboOption from '@/app/components/headless-form/combobox/DisableComboOption'
import AllowCustomVal from '@/app/components/headless-form/combobox/AllowCustomVal'
import ComboPosition from '@/app/components/headless-form/combobox/ComboPosition'
import ComboWidth from '@/app/components/headless-form/combobox/ComboWidth'
import WithTransitions from '@/app/components/headless-form/combobox/WithTransitions'
import WithFramerMotion from '@/app/components/headless-form/combobox/WithFramerMotion'
import BindingStringAsValue from '@/app/components/headless-form/combobox/BindingStringAsValue'
import MultipleSelectVal from '@/app/components/headless-form/combobox/MultipleSelectVal'
import ComboOnFocus from '@/app/components/headless-form/combobox/ComboOnFocus'
import RenderingCombobox from '@/app/components/headless-form/combobox/RenderAsDiffElements'
import BindingValues from '@/app/components/headless-form/combobox/BindingValues'
import ActiveOptionDetails from '@/app/components/headless-form/combobox/AcrtiveOptionDetails'
import VirtualScrollingCombo from '@/app/components/headless-form/combobox/VirtualScroll'

export const metadata: Metadata = {
  title: 'Headless Form Combobox',
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
          <BasicComobobox />
        </div>
        <div className='col-span-12'>
          <WithLabel />
        </div>
        <div className='col-span-12'>
          <DisableCombo />
        </div>
        <div className='col-span-12'>
          <DisableComboOption />
        </div>
        <div className='col-span-12'>
          <AllowCustomVal />
        </div>
        <div className='col-span-12'>
          <ComboPosition />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <ComboWidth />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <WithTransitions />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <WithFramerMotion />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <BindingStringAsValue />
        </div>

        <div className='md:col-span-6 col-span-12'>
          <ComboOnFocus />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <RenderingCombobox />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <BindingValues />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <ActiveOptionDetails />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <VirtualScrollingCombo />
        </div>
        <div className='md:col-span-6 col-span-12'>
          <MultipleSelectVal />
        </div>
      </div>
    </>
  )
}

export default page
