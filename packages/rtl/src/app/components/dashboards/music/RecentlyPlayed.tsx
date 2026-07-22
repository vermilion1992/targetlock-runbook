'use client'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Icon } from '@iconify/react/dist/iconify.js'
import { useState } from 'react'
import Link from 'next/link'

export const RecentlyPlayed = () => {
  const [playingKey, setPlayingKey] = useState<string | null>(null)

  const togglePlay = (key: string) => {
    setPlayingKey((prevKey) => (prevKey === key ? null : key))
  }
  const PlayedAlbums = [
    {
      key: 'music1',
      album: '/images/music/album5.jpg',
      albumName: 'Naach Meri Rani',
      artist: 'Guru Randhawa',
    },
    {
      key: 'music2',
      album: '/images/music/album7.jpg',
      albumName: 'Party Anthems',
      artist: 'Arijit Singh',
    },
    {
      key: 'music3',
      album: '/images/music/album8.jpg',
      albumName: 'Classic Melody',
      artist: 'Jagjit Singh',
    },
  ]
  return (
    <Card>
      <div className='mb-6'>
        <h6 className='card-title'>Recently Played</h6>
        <p className='card-subtitle'>What's on my playlist this week?</p>
      </div>
      <div className='grid grid-cols-12 gap-6'>
        {PlayedAlbums.map((item) => {
          const isPlaying = playingKey === item.key
          return (
            <div className='lg:col-span-4 col-span-12' key={item.key}>
              <Card className='p-0 overflow-hidden group'>
                <Link href='#'>
                  <Image
                    src={item.album}
                    alt='album'
                    width={30}
                    height={30}
                    className='max-w-full w-full group-hover:scale-[1.03] duration-300'
                  />
                </Link>
                <div className='p-3 flex justify-between'>
                  <div>
                    <h6 className='text-sm mb-1'>{item.albumName}</h6>
                    <p className='text-xs'>{item.artist}</p>
                  </div>
                  <div
                    onClick={() => togglePlay(item.key)}
                    className='w-9 h-9 bg-white relative z-10 cursor-pointer text-primary flex items-center justify-center rounded-full -mt-[30px] hover:bg-primary hover:text-white'>
                    <Icon
                      icon={
                        isPlaying ? 'solar:pause-linear' : 'solar:play-linear'
                      }
                      className='text-lg'
                    />
                  </div>
                </div>
              </Card>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
