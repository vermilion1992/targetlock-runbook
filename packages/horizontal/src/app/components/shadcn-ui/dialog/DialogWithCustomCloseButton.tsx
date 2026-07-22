'use client'

import CardBox from '../../shared/CardBox'
import DialogWithCustomClose from './code/DialogWithCustomCloseCode'

const DialogWithCustomCloseButton = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>Dialog With Custom Close</h4>
      <DialogWithCustomClose />
    </CardBox>
  )
}

export default DialogWithCustomCloseButton
