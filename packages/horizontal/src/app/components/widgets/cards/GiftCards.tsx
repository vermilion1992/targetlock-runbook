'use client'
import React from 'react'
import { Card } from '@/components/ui/card'
import { Icon } from '@iconify/react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'

const GiftCards = () => {
  return (
    <>
      <div className='grid grid-cols-12 gap-6'>
        <div className='sm:col-span-6 col-span-12'>
          <Card>
            <div className='flex items-center justify-between mb-3'>
              <h5 className='card-title'>Andrew Grant</h5>
              <Icon
                icon='solar:gift-outline'
                className='text-primary'
                height={20}
              />
            </div>
            <Image
              src='/images/products/s1.jpg'
              alt='maaterialm'
              width={600}
              height={150}
              className='rounded-lg w-full object-cover h-[150px]'
            />
            <Button className='mt-4'>Gift to Friend ($50.00)</Button>
          </Card>
        </div>
        <div className='sm:col-span-6 col-span-12'>
          <Card>
            <div className='flex items-center justify-between mb-3'>
              <h5 className='card-title'>Leo Pratt </h5>
              <Icon
                icon='solar:gift-outline'
                className='text-primary'
                height={20}
              />
            </div>
            <Image
              src='/images/products/s2.jpg'
              alt='maaterialm'
              width={600}
              height={150}
              className='rounded-lg w-full object-cover h-[150px]'
            />
            <Button className='mt-4'>Gift to Friend ($50.00)</Button>
          </Card>
        </div>
      </div>
    </>
  )
}

export default GiftCards
