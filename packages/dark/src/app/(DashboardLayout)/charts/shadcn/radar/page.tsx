// import Intro from '@/app/(site)/ui-blocks/shared/Intro'
import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import ChartRadarLabelCustom from '@/app/components/charts/shadcn/radar/CustomLabel'
import ChartRadarDefault from '@/app/components/charts/shadcn/radar/Default'
import ChartRadarDots from '@/app/components/charts/shadcn/radar/Dots'
import ChartRadarGridCircle from '@/app/components/charts/shadcn/radar/GridCircle'
import ChartRadarGridCircleFill from '@/app/components/charts/shadcn/radar/GridCircleFilled'
import ChartRadarGridCircleNoLines from '@/app/components/charts/shadcn/radar/GridCircleNoLines'
import ChartRadarGridCustom from '@/app/components/charts/shadcn/radar/GridCustom'
import ChartRadarGridFill from '@/app/components/charts/shadcn/radar/GridFilled'
import ChartRadarGridNone from '@/app/components/charts/shadcn/radar/GridNone'
import ChartRadarLegend from '@/app/components/charts/shadcn/radar/Legend'
import ChartRadarLinesOnly from '@/app/components/charts/shadcn/radar/LinesOnly'
import ChartRadarMultiple from '@/app/components/charts/shadcn/radar/Multiple'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Radar Chart Component for Dashboards Built with Shadcn UI',
  description: 'Create radar charts and spider web graphs with Shadcn UI components built with Tailwind React for dashboard multi-dimensional comparison.',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Shadcn Radar Chart',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Shadcn Radar Chart' items={BCrumb} />
      <div className='grid grid-cols-12 gap-5 sm:gap-7'>
        {/* intro */}
        {/* <div className='col-span-12'>
          <Intro detail={intro} />
        </div> */}
        {/* Default */}
        <div className='col-span-12'>
          <ChartRadarDefault />
        </div>
        {/* Dots */}
        <div className='col-span-12'>
          <ChartRadarDots />
        </div>
        {/* Lines Only */}
        <div className='col-span-12'>
          <ChartRadarLinesOnly />
        </div>
        {/* Custom Label */}
        <div className='col-span-12'>
          <ChartRadarLabelCustom />
        </div>
        {/* Grid Custom */}
        <div className='col-span-12'>
          <ChartRadarGridCustom />
        </div>
        {/* Grid None */}
        <div className='col-span-12'>
          <ChartRadarGridNone />
        </div>
        {/* Grid Circle */}
        <div className='col-span-12'>
          <ChartRadarGridCircle />
        </div>
        {/* Grid Circle - No lines */}
        <div className='col-span-12'>
          <ChartRadarGridCircleNoLines />
        </div>
        {/* Grid Circle Filled */}
        <div className='col-span-12'>
          <ChartRadarGridCircleFill />
        </div>
        {/* Grid Filled */}
        <div className='col-span-12'>
          <ChartRadarGridFill />
        </div>
        {/* Multiple */}
        <div className='col-span-12'>
          <ChartRadarMultiple />
        </div>
        {/* Legend */}
        <div className='col-span-12'>
          <ChartRadarLegend />
        </div>
      </div>
    </>
  )
}

export default page
