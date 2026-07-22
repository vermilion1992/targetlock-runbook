'use client'
import Image from 'next/image'
import React from 'react'

const LeftSidebarPart = () => {
  return (
    <>
      <div className='flex justify-center h-screen items-center z-10 relative'>
        <div className='xl:w-5/12 lg:w-10/12 xl:px-0 px-6'>
          <Image
            src={'/images/backgrounds/authBG.webp'}
            alt='bg-img'
            width={461}
            height={450}
          />
        </div>
      </div>
    </>
  )
}

export default LeftSidebarPart
