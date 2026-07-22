import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicCarousel from '@/app/components/shadcn-ui/carousel/BasicCarousel'
import CarouselWithultipleItem from '@/app/components/shadcn-ui/carousel/CarouselWithultipleItem'
import { VerticalCarousel } from '@/app/components/shadcn-ui/carousel/VerticalCarousel'

export const metadata: Metadata = {
  title: 'Ui Carousel',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Carousel',
  },
]
const page = () => {
  return (
    <>
      <BreadcrumbComp title='Carousel' items={BCrumb} />
      <div className='grid grid-cols-12 gap-6'>
        {/* Basic */}
        <div className='col-span-12'>
          <BasicCarousel />
        </div>
        <div className='col-span-12'>
          <VerticalCarousel />
        </div>
        <div className='col-span-12'>
          <CarouselWithultipleItem />
        </div>
      </div>
    </>
  )
}

export default page
