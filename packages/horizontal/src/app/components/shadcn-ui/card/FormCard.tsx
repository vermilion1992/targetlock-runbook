'use client'

import CardBox from '../../shared/CardBox'
import FormCardInfo from './code/FormCardCode'

const FormCard = () => {
  return (
    <>
      <CardBox className='p-0 shadow-none'>
        <div>
          <FormCardInfo />
        </div>
      </CardBox>
    </>
  )
}

export default FormCard
