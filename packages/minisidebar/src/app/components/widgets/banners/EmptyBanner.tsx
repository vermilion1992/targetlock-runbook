import React from 'react'
import { Card } from '@/components/ui/card'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
const EmptyBanner = () => {
  return (
    <>
      <Card>
        <Image
          src='/images/products/empty-shopping-bag.gif'
          alt='banner'
          width={192}
          height={192}
          className='mx-auto  w-48'
        />
        <div className='text-center mx-auto'>
          <h5 className='text-lg'>Oop, Your cart is empty!</h5>
          <p className='text-darklink mt-2'>
            Get back to shopping and get rewards from it.
          </p>
          <div className='flex justify-center mt-5'>
            <Button>Go for shopping</Button>
          </div>
        </div>
      </Card>
    </>
  )
}

export default EmptyBanner
