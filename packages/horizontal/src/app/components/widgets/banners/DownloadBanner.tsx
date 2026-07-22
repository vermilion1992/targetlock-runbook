import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

const DownloaadBanner = () => {
  return (
    <>
      <Card className='bg-lightprimary dark:bg-lightprimary shadow-none pb-0 mt-[30px]'>
        <div className='grid grid-cols-12 gap-6'>
          <div className='md:col-span-6 col-span-12'>
            <h5 className='text-lg mt-2'>
              Track your every Transaction Easily
            </h5>
            <p className='text-ld opacity-75 text-sm font-medium py-5'>
              Track and record your every income and expence easily to control
              your balance
            </p>
            <Button variant={'info'}>Download</Button>
          </div>
          <div className='md:col-span-6 col-span-12'>
            <Image
              src='/images/backgrounds/track-bg.png'
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

export default DownloaadBanner
