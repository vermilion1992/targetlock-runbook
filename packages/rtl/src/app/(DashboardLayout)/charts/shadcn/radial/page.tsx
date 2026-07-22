// import Intro from '@/app/(site)/ui-blocks/shared/Intro'
import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import ChartRadialSimple from '@/app/components/charts/shadcn/radial/Default'
import ChartRadialGrid from '@/app/components/charts/shadcn/radial/Grid'
import ChartRadialLabel from '@/app/components/charts/shadcn/radial/Label'
import ChartRadialShape from '@/app/components/charts/shadcn/radial/Shape'
import ChartRadialStacked from '@/app/components/charts/shadcn/radial/Stacked'
import ChartRadialText from '@/app/components/charts/shadcn/radial/Text'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Radial Chart Component for Dashboards Built with Shadcn UI',
  description: 'Build radial charts and circular progress graphs with Shadcn UI components built with Tailwind React for dashboard percentage visualization.',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Shadcn Radialbar',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Shadcn Radialbar Chart' items={BCrumb} />
      <div className='grid grid-cols-12 gap-5 sm:gap-7'>
        {/* Default */}
        <div className='col-span-12'>
          <ChartRadialSimple />
        </div>
        {/* Label */}
        <div className='col-span-12'>
          <ChartRadialLabel />
        </div>
        {/* Grid */}
        <div className='col-span-12'>
          <ChartRadialGrid />
        </div>
        {/* Text */}
        <div className='col-span-12'>
          <ChartRadialText />
        </div>
        {/* Shape */}
        <div className='col-span-12'>
          <ChartRadialShape />
        </div>
        {/* Stacked */}
        <div className='col-span-12'>
          <ChartRadialStacked />
        </div>
      </div>
    </>
  )
}

export default page
