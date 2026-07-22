'use client'

import CardBox from '../../shared/CardBox'
import Titletoast from './code/TitleToastCode'

const TitleToast = () => {
  return (
    <div>
      <CardBox>
        <h4 className='text-lg font-semibold'>Toast With Title</h4>
        <Titletoast />
      </CardBox>
    </div>
  )
}

export default TitleToast
