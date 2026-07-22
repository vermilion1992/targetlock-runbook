'use client'

import CardBox from '../../shared/CardBox'
import Loadingbutton from './code/LoadingButtonCode'

const LoadingButton = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>Loading Button</h4>
      <Loadingbutton />
    </CardBox>
  )
}

export default LoadingButton
