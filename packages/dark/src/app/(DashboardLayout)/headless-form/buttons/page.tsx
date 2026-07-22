import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicButtons from '@/app/components/headless-form/button/BasicButtons'
import LightButtons from '@/app/components/headless-form/button/LightButtons'
import RoundedOutlineBtn from '@/app/components/headless-form/button/RoundedOutlineBtn'
import SquareOutlineBtn from '@/app/components/headless-form/button/SquareOutlineBtn'
import DisableButton from '@/app/components/headless-form/button/DisableButton'
import DisableOutlineButtons from '@/app/components/headless-form/button/DisableOutlineButtons'

export const metadata: Metadata = {
  title: 'Headless Form Button',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Button',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Button' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicButtons />
        </div>
        <div className='col-span-12'>
          <LightButtons />
        </div>
        <div className='col-span-12'>
          <RoundedOutlineBtn />
        </div>
        <div className='col-span-12'>
          <SquareOutlineBtn />
        </div>
        <div className='col-span-12'>
          <DisableButton />
        </div>
        <div className='col-span-12'>
          <DisableOutlineButtons />
        </div>
      </div>
    </>
  )
}

export default page
