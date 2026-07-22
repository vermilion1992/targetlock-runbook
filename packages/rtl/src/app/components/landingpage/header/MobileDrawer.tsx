'use client'
import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { IconMenu2 } from '@tabler/icons-react'
import Link from 'next/link'
import FullLogo from '@/app/(DashboardLayout)/layout/shared/logo/FullLogo'
import MobileDemosMenu from './MobileDemoMenus'

const MobileDrawer = () => {
  const [isOpen, setIsOpen] = useState(false)

  const handleClose = () => setIsOpen(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1023) {
        handleClose()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <>
      <div className='lg:hidden flex'>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant='lightprimary'>
              <IconMenu2 className='!shrink-0' />
            </Button>
          </SheetTrigger>

          <SheetContent side='left' className='p-6 w-[280px]'>
            <SheetHeader>
              <SheetTitle>
                <FullLogo />
              </SheetTitle>
            </SheetHeader>

            <div className='mt-4 space-y-3'>
              <MobileDemosMenu onClose={handleClose} />

              <Link
                href='https://tailwind-admin.github.io/tailwind-admin-documentation/premium-documentation/nextjs/index.html'
                target='_blank'
                onClick={() => handleClose()}
                className='block text-base text-dark dark:text-white font-semibold'>
                Documentation
              </Link>

              <Link
                href='https://tailwind-admin.com/support'
                target='_blank'
                onClick={() => handleClose()}
                className='block text-base text-dark dark:text-white font-semibold'>
                Support
              </Link>

              <Button className='mt-4 w-full' asChild>
                <Link href='/auth/auth2/login'>Login</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

export default MobileDrawer
