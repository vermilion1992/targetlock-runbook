'use client'

import CardBox from '../../shared/CardBox'
import Actiontoast from './code/ActionToastCode'

const ActionToast = () => {
  return (
    <div>
      <CardBox>
        <h4 className='text-lg font-semibold'>Toast With Action</h4>
        <Actiontoast />
      </CardBox>
    </div>
  )
}

export default ActionToast
