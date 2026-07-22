import type { Metadata } from 'next'
import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicPopover from '@/app/components/headless-ui/popover/BasicPopover'
import GroupingPopover from '@/app/components/headless-ui/popover/GroupingPopover'
import PopoverWidth from '@/app/components/headless-ui/popover/PopoverWidth'
import PopoverPositioning from '@/app/components/headless-ui/popover/PopoverPositioning'
import PopoverBackdrops from '@/app/components/headless-ui/popover/PopoverBackdrop'
import PopoverTransition from '@/app/components/headless-ui/popover/PopoverTransition'
import FramerMotionPopover from '@/app/components/headless-ui/popover/FramerMotionPopover'
import ClosingPopoverManual from '@/app/components/headless-ui/popover/ClosingPopoverManual'
import RenderAsElement from '@/app/components/headless-ui/popover/RenderAsElement'

export const metadata: Metadata = {
  title: 'HeadlessUI Popover',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Popover',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Popover' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <BasicPopover />
        </div>
        <div className='col-span-12'>
          <GroupingPopover />
        </div>
        <div className='col-span-12'>
          <PopoverWidth />
        </div>
        <div className='col-span-12'>
          <PopoverPositioning />
        </div>
        <div className='col-span-12'>
          <PopoverBackdrops />
        </div>
        <div className='col-span-12'>
          <PopoverTransition />
        </div>
        <div className='col-span-12'>
          <FramerMotionPopover />
        </div>
        <div className='col-span-12'>
          <ClosingPopoverManual />
        </div>
        <div className='col-span-12'>
          <RenderAsElement />
        </div>
      </div>
    </>
  )
}

export default page
