'use client'

import CardBox from '../../shared/CardBox'
import Otpinput from './code/OtpInputCode'

const OtpInput = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>OTP Input</h4>
      <Otpinput />
    </CardBox>
  )
}

export default OtpInput
