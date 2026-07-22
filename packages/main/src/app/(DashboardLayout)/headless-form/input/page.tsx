import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import InputWithLabel from '@/app/components/headless-form/input/InputWithLabel'
import SquareInputWithLabel from '@/app/components/headless-form/input/SquareInputWithLabel'
import InputWithDescription from '@/app/components/headless-form/input/InputWithDescription'
import DisabledInput from '@/app/components/headless-form/input/DisableInput'

export const metadata: Metadata = {
  title: 'Headless Form input',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'input',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='input' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <InputWithLabel />
        </div>
        <div className='col-span-12'>
          <SquareInputWithLabel />
        </div>
        <div className='col-span-12'>
          <InputWithDescription />
        </div>
        <div className='col-span-12'>
          <DisabledInput />
        </div>
      </div>
    </>
  )
}

export default page
