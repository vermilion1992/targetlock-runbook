'use client'
import Image from 'next/image'
import React from 'react'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Lottie from 'lottie-react'
import error404page from '@/../public/animation/error404page.json'

const Error = () => {
  return (
    <>
      <div className='h-screen flex items-center justify-center bg-white dark:bg-dark'>
        <div className='text-center'>
          <Lottie animationData={error404page} loop={true} />
          <h1 className='text-ld text-4xl mb-6'>Opps!!!</h1>
          <h6 className='text-xl text-ld'>
            This page you are looking for could not be found.
          </h6>
          <Button asChild className='mt-6 mx-auto'>
            <Link href='/'>Go Back to Home</Link>
          </Button>
        </div>
      </div>
    </>
  )
}

export default Error
