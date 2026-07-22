import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicSwitches from '@/app/components/headless-form/switch/BasicSwitches'
import DefaultOnSwitches from '@/app/components/headless-form/switch/DefaultOnSwitches'
import DisabledSwitches from '@/app/components/headless-form/switch/DisabledSwitches'
import WithLabelSwitch from '@/app/components/headless-form/switch/WithLabelSwitch'
import WithTransitionsSwitch from '@/app/components/headless-form/switch/WithTransitions'
import RenderSwitches from '@/app/components/headless-form/switch/RenderSwitches'

export const metadata: Metadata = {
  title: 'Headless Form Switch',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Switch',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Switch' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicSwitches />
        </div>
        <div className='col-span-12'>
          <DefaultOnSwitches />
        </div>
        <div className='col-span-12'>
          <DisabledSwitches />
        </div>
        <div className='col-span-12'>
          <WithLabelSwitch />
        </div>
        <div className='col-span-12'>
          <WithTransitionsSwitch />
        </div>
        <div className='col-span-12'>
          <RenderSwitches />
        </div>
      </div>
    </>
  )
}

export default page
