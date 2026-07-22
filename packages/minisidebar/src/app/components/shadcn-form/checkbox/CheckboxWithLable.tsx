'use client'

import CardBox from '../../shared/CardBox'
import Checkboxlabel from './code/CheckboxLabelCode'

const CheckboxWithLable = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>With Label</h4>
      <Checkboxlabel />
    </CardBox>
  )
}

export default CheckboxWithLable
