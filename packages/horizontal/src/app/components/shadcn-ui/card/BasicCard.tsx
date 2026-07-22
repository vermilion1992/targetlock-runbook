'use client'

import CardBox from '../../shared/CardBox'
import BasicCardInfo from './code/BasicCardCode'

const BasicCard = () => {
  return (
    <>
      <CardBox className='p-0 shadow-none'>
        <div>
          <BasicCardInfo />
        </div>
      </CardBox>
    </>
  )
}

export default BasicCard
