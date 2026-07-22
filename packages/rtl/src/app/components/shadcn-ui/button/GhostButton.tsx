'use client'

import CardBox from '../../shared/CardBox'
import Ghostbutton from './code/GhostButtonCode'

const GhostButton = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>Ghost Button</h4>
      <Ghostbutton />
    </CardBox>
  )
}

export default GhostButton
