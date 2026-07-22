import Image from 'next/image'
import React from 'react'

const Development = () => {
  return (
    <>
      <div className='bg-white dark:bg-dark md:py-20 py-12'>
        <div className='container'>
          <div
            className='lg:w-3/5 w-full mx-auto'
            data-aos='fade-up'
            data-aos-duration='500'>
            <h2 className='text-center sm:text-4xl text-2xl mt-8 font-bold sm:!leading-[45px]'>
              Increase speed of your development and launch quickly with
              TailwindAdmin
            </h2>
          </div>
        </div>

        <div className='flex flex-row w-full position-relative overflow-hidden pt-8'>
          <div className='slider-group'>
            <Image
              src='/images/landingpage/background/slider-group.png'
              alt='tailwind-admin'
              width={600}
              height={400}
              className='max-w-max'
            />
          </div>
          <div className='slider-group'>
            <Image
              src='/images/landingpage/background/slider-group.png'
              alt='tailwind-admin'
              width={600}
              height={400}
              className='max-w-max'
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default Development
