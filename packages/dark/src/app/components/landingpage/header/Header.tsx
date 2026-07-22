'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import FullLogo from '@/app/(DashboardLayout)/layout/shared/logo/FullLogo'
import PagesMenu from './PagesMenu'
import DemosMenu from './DemosMenu'
import MobileDrawer from './MobileDrawer'
import FrontPageMenu from './FrontPageMenu'
import { Button } from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from '@/components/ui/navigation-menu'

const Header = () => {
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all ${
        isSticky ? 'bg-white dark:bg-dark shadow-md' : 'bg-white dark:bg-dark'
      }`}>
      <div className='container mx-auto flex items-center justify-between py-6 px-4'>
        <FullLogo />
        {/* Mobile drawer (Hamburger) */}
        <MobileDrawer />
        {/* Desktop Navigation */}
        <nav className='hidden lg:flex gap-6 items-center'>
          <NavigationMenu>
            <NavigationMenuList className='flex gap-4'>
              <NavigationMenuItem>
                <DemosMenu />
              </NavigationMenuItem>
              <NavigationMenuItem>
                <FrontPageMenu />
              </NavigationMenuItem>
              <NavigationMenuItem>
                <PagesMenu />
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link
                  href='https://tailwind-admin.github.io/tailwind-admin-documentation/premium-documentation/nextjs/index.html'
                  target='_blank'
                  className='!py-2 px-4 text-base text-ld hover:text-primary hover:bg-lightprimary rounded-md flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary'>
                  Documentation
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link
                  href='https://tailwind-admin.com/support'
                  target='_blank'
                  className='!py-2 px-4 text-base text-ld hover:text-primary hover:bg-lightprimary rounded-md flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary'>
                  Support
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Button asChild>
                  <Link
                    href='/auth/auth1/login'
                    className='bg-primary text-white text-sm px-5 py-2 hover:bg-primary/90'>
                    Login
                  </Link>
                </Button>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </nav>
      </div>
    </header>
  )
}

export default Header
