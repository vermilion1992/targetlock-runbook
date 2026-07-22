'use client'

import CardBox from '../../shared/CardBox'
import Rangedatepicker from './code/DateRangePickerCode'

const DateRangePicker = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>Date Range Picker</h4>
      <Rangedatepicker />
    </CardBox>
  )
}

export default DateRangePicker
