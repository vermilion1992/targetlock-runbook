'use client'
import { Icon } from '@iconify/react'
import Image from 'next/image'
import React from 'react'
import { Card } from '@/components/ui/card'
/*--Music Cards--*/
const musicCard = [
  {
    title: 'Uptown Funk',
    subheader: 'Jon Bon Jovi',
    img: '/images/blog/blog-img8.jpg',
  },
  {
    title: 'Blank Space',
    subheader: 'Madonna',
    img: '/images/blog/blog-img9.jpg',
  },
  {
    title: 'Lean On',
    subheader: 'Jennifer Lopez',
    img: '/images/blog/blog-img8.jpg',
  },
]

const MusicCards = () => {
  return (
    <>
      <div className='grid grid-cols-12 gap-6'>
        {musicCard.map((item, i) => (
          <div className='lg:col-span-4 col-span-12' key={i}>
            <Card className='overflow-hidden p-0'>
              <div className='grid grid-cols-12 gap-6'>
                <div className='col-span-6 p-6'>
                  <h5 className='text-lg '>{item.title}</h5>
                  <p className='text-darklink'>{item.subheader}</p>
                  <div className='flex justify-between items-center pt-12 cursor-pointer'>
                    <Icon icon='tabler:player-skip-back' height={22} />
                    <Icon
                      icon='tabler:player-play'
                      className='text-error'
                      height={20}
                    />
                    <Icon icon='tabler:player-skip-forward' height={22} />
                  </div>
                </div>
                <div className='col-span-6'>
                  <Image
                    src={item.img}
                    alt='tailwindadmin'
                    width={400}
                    height={300}
                    className='h-full object-cover'
                  />
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </>
  )
}

export default MusicCards
