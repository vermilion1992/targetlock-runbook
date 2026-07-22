import React from 'react'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

import { Button } from '@/components/ui/button'

const userImg = [
  {
    user: '/images/profile/user-2.jpg',
  },
  {
    user: '/images/profile/user-3.jpg',
  },
  {
    user: '/images/profile/user-4.jpg',
  },
]
const StillHaveQst = () => {
  return (
    <Card className='bg-lightprimary dark:bg-lightprimary mt-10 rounded-md text-center py-8'>
      <div className='flex justify-center'>
        {userImg.map((item, index) => (
          <div className='-ms-2  h-11 w-11' key={index}>
            <Image
              src={item.user}
              className='border-2 border-white dark:border-darkborder rounded-full'
              alt='icon'
              width={44}
              height={44}
            />
          </div>
        ))}
      </div>
      <h4 className='text-2xl font-bold mt-4'>Still have questions</h4>
      <p className='text-primary dark:text-primary text-base '>
        Can't find the answer your're looking for ? Please chat to our friendly
        team.
      </p>
      <Button className='w-fit mx-auto mt-4'>Chat with us</Button>
    </Card>
  )
}

export default StillHaveQst
