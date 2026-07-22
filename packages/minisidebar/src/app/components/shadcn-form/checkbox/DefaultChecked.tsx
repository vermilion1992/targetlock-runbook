'use client'

import CardBox from '../../shared/CardBox'
import DefaultCheck from './code/DefaultCheckCode'

const DefaultChecked = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>Default Checked</h4>
      <DefaultCheck />
    </CardBox>
  )
}

export default DefaultChecked
