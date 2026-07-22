// import Intro from '@/app/(site)/ui-blocks/shared/Intro'
import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import ChartLineDotsCustom from '@/app/components/charts/shadcn/line/CustomDots'
import ChartLineLabelCustom from '@/app/components/charts/shadcn/line/CustomLabel'
import ChartLineDefault from '@/app/components/charts/shadcn/line/Default'
import ChartLineDots from '@/app/components/charts/shadcn/line/Dots'
import ChartLineDotsColors from '@/app/components/charts/shadcn/line/DotsColors'
import ChartLineInteractive from '@/app/components/charts/shadcn/line/Interactive'
import ChartLineLabel from '@/app/components/charts/shadcn/line/Label'
import ChartLineLinear from '@/app/components/charts/shadcn/line/Linear'
import ChartLineMultiple from '@/app/components/charts/shadcn/line/Multiple'
import ChartLineStep from '@/app/components/charts/shadcn/line/Step'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Line Chart Component for Dashboards Built with Shadcn UI',
  description: 'Create smooth line charts and trend graphs with Shadcn UI components built with Tailwind React for dashboard time-series visualization.',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Shadcn Line Chart',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Shadcn Line Chart' items={BCrumb} />
      <div className='grid grid-cols-12 gap-5 sm:gap-7'>        
        {/* Default */}
        <div className='col-span-12'>
          <ChartLineDefault />
        </div>
        {/* Linear */}
        <div className='col-span-12'>
          <ChartLineLinear />
        </div>
        {/* Step */}
        <div className='col-span-12'>
          <ChartLineStep />
        </div>
        {/* Multiple */}
        <div className='col-span-12'>
          <ChartLineMultiple />
        </div>
        {/* Dots */}
        <div className='col-span-12'>
          <ChartLineDots />
        </div>
        {/* Custom Dots */}
        <div className='col-span-12'>
          <ChartLineDotsCustom />
        </div>
        {/* Dots Colors */}
        <div className='col-span-12'>
          <ChartLineDotsColors />
        </div>
        {/* Label */}
        <div className='col-span-12'>
          <ChartLineLabel />
        </div>
        {/* Custom Label */}
        <div className='col-span-12'>
          <ChartLineLabelCustom />
        </div>
        {/* Interactive */}
        <div className='col-span-12'>
          <ChartLineInteractive />
        </div>
      </div>
    </>
  )
}

export default page
