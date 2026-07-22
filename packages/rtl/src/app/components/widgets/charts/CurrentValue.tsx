import React from 'react'
import { Button } from '@/components/ui/button'
import OutlineCard from '../../shared/OutlineCard'
import IncomeChart from './IncomeChart'
import ExpnaceChart from './ExpnaceChart'
import CurrentYear from './CurrentYear'
import { Card } from '@/components/ui/card'

const CurrentValue = () => {
  return (
    <>
      <Card>
        <div className='flex justify-between items-end'>
          <h5 className='card-title'>Current Value</h5>
          <div className='flex gap-3'>
            <Button>Buy</Button>
            <Button variant={'outline'}>Sell</Button>
          </div>
        </div>

        <div className='grid grid-cols-12 gap-6 mt-6'>
          <div className='lg:col-span-4 col-span-12'>
            <OutlineCard className='shadow-none'>
              <IncomeChart />
            </OutlineCard>
          </div>
          <div className='lg:col-span-4 col-span-12'>
            <OutlineCard className='shadow-none'>
              <ExpnaceChart />
            </OutlineCard>
          </div>
          <div className='lg:col-span-4 col-span-12'>
            <OutlineCard className='shadow-none'>
              <CurrentYear />
            </OutlineCard>
          </div>
        </div>
      </Card>
    </>
  )
}

export default CurrentValue
