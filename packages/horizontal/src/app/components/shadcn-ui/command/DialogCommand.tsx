'use client'

import CardBox from '../../shared/CardBox'
import Dialogcommand from './code/DialogCommandCode'

const DialogCommand = () => {
  return (
    <CardBox>
      <div>
        <h4 className='text-lg font-semibold'>Dialog Command</h4>
        <p className='text-darklink dark:text-bodytext'>
          Please press CTRL + J to show command dialog
        </p>
      </div>
      <Dialogcommand />
    </CardBox>
  )
}

export default DialogCommand
