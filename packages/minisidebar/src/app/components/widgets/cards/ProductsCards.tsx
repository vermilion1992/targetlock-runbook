'use client'
import React from 'react'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import Image from 'next/image'
import { Icon } from '@iconify/react'
/*--Products Cards--*/
const productsCardData = [
  {
    title: 'Boat Headphone',
    link: '/',
    photo: '/images/products/s2.jpg',
    salesPrice: 375,
    price: 285,
    rating: 4,
  },
  {
    title: 'MacBook Air Pro',
    link: '/',
    photo: '/images/products/s5.jpg',
    salesPrice: 650,
    price: 900,
    rating: 5,
  },
  {
    title: 'Red Valvet Dress',
    link: '/',
    photo: '/images/products/s8.jpg',
    salesPrice: 150,
    price: 200,
    rating: 3,
  },
  {
    title: 'Cute Soft Teddybear',
    link: '/',
    photo: '/images/products/s11.jpg',
    salesPrice: 285,
    price: 345,
    rating: 2,
  },
]

const ProductsCards = () => {
  // Helper to render stars based on rating
  const renderStars = (rating: number) => {
    const totalStars = 5
    let stars = []
    for (let i = 1; i <= totalStars; i++) {
      stars.push(
        <Icon
          key={i}
          icon={i <= rating ? 'solar:star-bold' : 'solar:star-linear'}
          className={`w-5 h-5 ${
            i <= rating ? 'text-yellow-400' : 'text-gray-300'
          }`}
        />
      )
    }
    return stars
  }

  return (
    <>
      <div className='grid grid-cols-12 gap-6'>
        {productsCardData.map((item, i) => (
          <div className='lg:col-span-3 md:col-span-6 col-span-12' key={i}>
            <Link href={item.link} className='group'>
              <Card className='p-0 overflow-hidden gap-2'>
                <div className='relative'>
                  <Image
                    src={item.photo}
                    alt='materialm'
                    width={400}
                    height={300}
                  />
                </div>
                <div className='px-6 pb-6 relative'>
                  <button className='rounded-full z-1 absolute right-4 -top-8 bg-primary text-white flex justify-center items-center p-2 '>
                    <Icon
                      icon='solar:bag-5-linear'
                      height={24}
                      width={24}
                      className='w-6 h-6'
                    />
                  </button>
                  <h5 className='text-lg mb-1'>{item.title}</h5>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <h6 className='text-h6'>${item.price}</h6>
                      <span className='text-sm font-medium line-through text-darklink'>
                        ${item.salesPrice}
                      </span>
                    </div>
                    <div className='flex'>{renderStars(item.rating)}</div>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}

export default ProductsCards
