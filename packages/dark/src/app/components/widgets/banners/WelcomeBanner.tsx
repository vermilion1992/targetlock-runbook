import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

const WelcomeBanner = () => {
  return (
    <>
      <Card className='bg-primary-gt shadow-none pb-0'>
        <div className='grid grid-cols-12 gap-6'>
          <div className='md:col-span-6 col-span-12'>
            <h5 className='text-lg text-white mt-2'>Welcome back David!</h5>
            <p className='text-white opacity-75 text-sm font-medium py-5'>
              You have earned 54% more than last month which is great thing.
            </p>
            <Button variant={'error'}>Check</Button>
          </div>
          <div className='md:col-span-6 col-span-12'>
            <Image
              src='/images/backgrounds/welcome-bg2.png'
              alt='banner'
              width={400}
              height={240}
              className='ms-auto'
            />
          </div>
        </div>
      </Card>
    </>
  )
}

export default WelcomeBanner
