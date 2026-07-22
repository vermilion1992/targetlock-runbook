'use client'
import { Icon } from '@iconify/react/dist/iconify.js'
// Import Swiper React components
import { Swiper, SwiperSlide, useSwiper, useSwiperSlide } from 'swiper/react'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/pagination'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
// Import Swiper types
import { Swiper as SwiperClass } from 'swiper/types'

export const Leadership = () => {
  const Leaders = [
    {
      key: 'leader1',
      img: '/images/frontend-pages/leaders/leader1.jpg',
      name: 'Alex Martinez',
      designation: 'CEO & Co-Founder',
    },
    {
      key: 'leader2',
      img: '/images/frontend-pages/leaders/leader2.jpg',
      name: 'Jordan Nguyen',
      designation: 'CTO & Co-Founder',
    },
    {
      key: 'leader3',
      img: '/images/frontend-pages/leaders/leader3.jpg',
      name: 'Taylor Roberts',
      designation: 'Product Manager',
    },
    {
      key: 'leader4',
      img: '/images/frontend-pages/leaders/leader4.jpg',
      name: 'Katherine lily',
      designation: 'Lead Developer',
    },
    {
      key: 'leader5',
      img: '/images/frontend-pages/leaders/leader1.jpg',
      name: 'Alex Martinez',
      designation: 'CEO & Co-Founder',
    },
    {
      key: 'leader6',
      img: '/images/frontend-pages/leaders/leader2.jpg',
      name: 'Jordan Nguyen',
      designation: 'CTO & Co-Founder',
    },
  ]
  const swiperRef = useRef<SwiperClass | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  return (
    <section>
      <div className='lg:pt-24 lg:pb-[66px] pb-[18px] container-md px-4 pt-12'>
        <div className='flex justify-between items-center flex-wrap md:gap-0 gap-2'>
          <div className='flex flex-col gap-4'>
            <h2 className='leading-tight text-link dark:text-white font-bold text-2xl sm:text-3xl md:text-40'>
              Our leadership
            </h2>
            <p className='max-w-96 text-lightmuted dark:text-darklink text-base'>
              Our robust analytics offer rich insights into the information
              buyers want, informing where teams
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <div
              onClick={() => swiperRef.current?.slidePrev()}
              className={`h-12 w-12 rounded-full flex items-center justify-center bg-lightprimary text-link dark:text-darklink dark:bg-lightprimary ${
                currentIndex === 0
                  ? 'pointer-events-none opacity-50'
                  : 'cursor-pointer'
              }`}>
              <Icon icon='tabler:arrow-left' className='shrink-0 text-2xl' />
            </div>
            <div
              onClick={() => swiperRef.current?.slideNext()}
              className={`h-12 w-12 rounded-full flex items-center justify-center bg-lightprimary text-link dark:text-darklink dark:bg-lightprimary  ${
                currentIndex === Leaders.length - 4
                  ? 'pointer-events-none opacity-50'
                  : 'cursor-pointer'
              } `}>
              <Icon icon='tabler:arrow-right' className='shrink-0 text-2xl' />
            </div>
          </div>
        </div>
        <div className='mt-8'>
          <Swiper
            onSwiper={(swiper: SwiperClass) => {
              // Store the swiper instance in the ref
              swiperRef.current = swiper
            }}
            onSlideChange={(swiper: SwiperClass) => {
              setCurrentIndex(swiper.activeIndex) // Update current slide index on slide change
            }}
            slidesPerView={4}
            spaceBetween={30}
            className='mySwiper leader-swiper'
            breakpoints={{
              0: {
                slidesPerView: 1,
                spaceBetween: 20,
              },
              640: {
                slidesPerView: 2,
                spaceBetween: 20,
              },
              768: {
                slidesPerView: 3,
                spaceBetween: 30,
              },
              1024: {
                slidesPerView: 4,
                spaceBetween: 30,
              },
            }}>
            {Leaders.map((item) => {
              return (
                <SwiperSlide key={item.key}>
                  <div className='img-wrapper'>
                    <Image
                      src={item.img}
                      alt='leader-image'
                      width={400}
                      height={500}
                      className='rounded-2xl'
                    />
                    <div className='px-6'>
                      <div className='rounded-[10px] z-20 relative bg-white dark:bg-dark text-center custom-shadow2 -mt-10 py-4 px-3'>
                        <h3 className='text-lg text-link dark:text-white font-semibold'>
                          {item.name}
                        </h3>
                        <div className='text-sm text-lightmuted dark:text-darklink'>
                          {item.designation}
                        </div>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              )
            })}
          </Swiper>
        </div>
      </div>
    </section>
  )
}
