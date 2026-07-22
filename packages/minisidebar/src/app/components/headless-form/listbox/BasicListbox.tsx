'use client'

import CardBox from '../../shared/CardBox'
import BasicList from './codes/BasicListCode'

const BasicListbox = () => {
  return (
    <div>
      <CardBox>
        <h4 className='text-lg font-semibold mb-4'>Basic Listbox</h4>
        <BasicList />
      </CardBox>
    </div>
  )
}

export default BasicListbox
