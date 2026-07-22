'use client'
import React from 'react'
import { useState } from 'react'
import Image from 'next/image'
import { TbCheck, TbX } from 'react-icons/tb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'

const pricing = [
  {
    id: 1,
    package: 'Silver',
    plan: 'Free',
    monthlyplan: 'Free',
    avatar: '/images/backgrounds/silver.png',
    badge: false,
    btntext: 'Choose Silver',
    rules: [
      {
        limit: true,
        title: '3 Members',
      },
      {
        limit: true,
        title: 'Single Device',
      },
      {
        limit: false,
        title: '50GB Storage',
      },
      {
        limit: false,
        title: 'Monthly Backups',
      },
      {
        limit: false,
        title: 'Permissions & workflows',
      },
    ],
  },
  {
    id: 2,
    package: 'Bronze',
    monthlyplan: 10.99,
    avatar: '/images/backgrounds/bronze.png',
    badge: true,
    btntext: 'Choose Bronze',
    rules: [
      {
        limit: true,
        title: '5 Members',
      },
      {
        limit: true,
        title: 'Multiple Device',
      },
      {
        limit: true,
        title: '80GB Storage',
      },
      {
        limit: false,
        title: 'Monthly Backups',
      },
      {
        limit: false,
        title: 'Permissions & workflows',
      },
    ],
  },
  {
    id: 3,
    package: 'Gold',
    monthlyplan: 22.99,
    avatar: '/images/backgrounds/gold.png',
    badge: false,
    btntext: 'Choose Gold',
    rules: [
      {
        limit: true,
        title: 'Unlimited Members',
      },
      {
        limit: true,
        title: 'Multiple Device',
      },
      {
        limit: true,
        title: '150GB Storage',
      },
      {
        limit: true,
        title: 'Monthly Backups',
      },
      {
        limit: true,
        title: 'Permissions & workflows',
      },
    ],
  },
]

const PricingIndex = () => {
  const [switch1, setSwitch1] = useState(false)
  const yearlyPrice = (a: number, b: number) => a * b

  return (
    <>
      <div className='flex justify-center py-10'>
        <h2 className='text-3xl  max-w-xl text-center font-bold leading-[45px]'>
          Flexible Plans Tailored to Fit Your Community's Unique Needs!
        </h2>
      </div>
      <div className='flex items-center justify-center'>
        <div className='flex gap-2'>
          <p>Monthly</p>
          <Switch
            checked={switch1}
            onCheckedChange={() => setSwitch1(!switch1)}
          />
          <p>Yearly</p>
        </div>
      </div>

      <div className='grid grid-cols-12 gap-6 mt-8'>
        {pricing.map((price, i) => (
          <div className='md:col-span-4 col-span-12' key={i}>
            <Card className='relative'>
              {price.badge ? (
                <Badge
                  variant={'lightWarning'}
                  className='uppercase font-bold absolute top-4 end-6'>
                  Popular
                </Badge>
              ) : null}
              <h6 className='text-xs font-bold opacity-70 uppercase'>
                {price.package}
              </h6>
              <Image
                src={price.avatar}
                alt='icon'
                width={90}
                height={90}
                className='my-6'
              />
              <div>
                {price.plan == 'Free' ? (
                  <h2 className='text-5xl font-bold'>{price.plan}</h2>
                ) : (
                  <div className='flex'>
                    <small className='text-xl font-bold text-ld -mt-2 me-2'>
                      $
                    </small>
                    {switch1 ? (
                      <>
                        <h2 className='text-5xl font-bold'>
                          {yearlyPrice(Number(price.monthlyplan), 12)}
                        </h2>
                        <p className='text-base text-dark opacity-70 dark:text-white  mt-3 ms-1.5'>
                          /yr
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className='text-5xl font-bold'>
                          {price.monthlyplan}
                        </h2>
                        <p className='text-base text-dark opacity-70 dark:text-white mt-3 ms-1.5'>
                          /mo
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className=''>
                <ul className='border-0 mt-5 dark:bg-transparent'>
                  {price.rules.map((rule, i) => (
                    <React.Fragment key={i}>
                      {rule.limit ? (
                        <>
                          <li className='flex items-center gap-2 pb-4'>
                            <TbCheck size={15} className='text-primary' />
                            {rule.title}
                          </li>
                        </>
                      ) : (
                        <li className='flex items-center gap-2 pb-4 opacity-70'>
                          <TbX size={15} />
                          {rule.title}
                        </li>
                      )}
                    </React.Fragment>
                  ))}
                </ul>
              </div>
              <Button className='w-full mt-3'>{price.btntext}</Button>
            </Card>
          </div>
        ))}
      </div>
    </>
  )
}

export default PricingIndex
