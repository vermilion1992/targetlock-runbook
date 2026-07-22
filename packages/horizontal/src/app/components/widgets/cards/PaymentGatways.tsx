'use client'
import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import Image from 'next/image'

const PaymentGateway = () => {
  const RecentTransData = [
    {
      img: '/images/svgs/icon-paypal.svg',
      title: 'PayPal Transfer',
      subtitle: 'Money added',
      rank: '+$6,235',
      disable: '',
      bgcolor: 'secondary',
    },
    {
      img: '/images/svgs/icon-office-bag.svg',
      title: 'Wallet',
      subtitle: 'Bill payment',
      rank: '+$345',
      disable: 'opacity-80',
      bgcolor: 'success',
    },
    {
      img: '/images/svgs/icon-master-card.svg',
      title: 'Credit Card',
      subtitle: 'Money reversed',
      rank: '+$2,235',
      disable: '',
      bgcolor: 'warning',
    },
    {
      img: '/images/svgs/icon-pie.svg',
      title: 'Refund',
      subtitle: 'Bill Payment',
      rank: '-$32',
      disable: 'opacity-80',
      bgcolor: 'error',
    },
  ]
  return (
    <>
      <Card>
        <div>
          <h5 className='card-title'>Recent Transactions</h5>
          <p className='card-subtitle'>Platform for Income</p>
        </div>
        <div className='mt-7 flex flex-col gap-6'>
          {RecentTransData.map((item, index) => (
            <div className='flex gap-3.5 items-center' key={index}>
              <div
                className={`h-11 w-11 rounded-md flex justify-center items-center bg-light${item.bgcolor} dark:bg-dark${item.bgcolor}`}>
                <Image
                  src={item.img}
                  alt='icon'
                  width={24}
                  height={24}
                  className='h-6 w-6'
                />
              </div>
              <div>
                <h5 className='text-base'>{item.title}</h5>
                <p className='text-sm text-darklink'>{item.subtitle}</p>
              </div>
              <div className={`ms-auto font-medium text-ld ${item.disable}`}>
                {item.rank}
              </div>
            </div>
          ))}
        </div>
        <div className=''>
          <Button className='w-full mt-7'>View All Transactions</Button>
        </div>
      </Card>
    </>
  )
}

export default PaymentGateway
