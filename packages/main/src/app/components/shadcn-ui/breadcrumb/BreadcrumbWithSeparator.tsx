'use client'

import CardBox from '../../shared/CardBox'
import BreadcrumbWithseparator from './code/BreadcrumbWithSeparatorCode'

const BreadcrumbWithSeparator = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>
        Breadcrumb With Custom Separator
      </h4>
      <BreadcrumbWithseparator />
    </CardBox>
  )
}

export default BreadcrumbWithSeparator
