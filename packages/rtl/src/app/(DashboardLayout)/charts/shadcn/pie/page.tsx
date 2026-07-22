// import Intro from '@/app/(site)/ui-blocks/shared/Intro'
import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import ChartPieLabelCustom from '@/app/components/charts/shadcn/pie/CustomLabel'
import ChartPieSimple from '@/app/components/charts/shadcn/pie/Default'
import ChartPieDonut from '@/app/components/charts/shadcn/pie/Donut'
import ChartPieDonutActive from '@/app/components/charts/shadcn/pie/DonutActive'
import ChartPieDonutText from '@/app/components/charts/shadcn/pie/DonutWithText'
import ChartPieInteractive from '@/app/components/charts/shadcn/pie/Interactive'
import ChartPieLabel from '@/app/components/charts/shadcn/pie/Label'
import ChartPieLabelList from '@/app/components/charts/shadcn/pie/LabelList'
import ChartPieLegend from '@/app/components/charts/shadcn/pie/Legend'
import ChartPieSeparatorNone from '@/app/components/charts/shadcn/pie/SeparatorNone'
import ChartPieStacked from '@/app/components/charts/shadcn/pie/Stacked'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pie Chart Component for Dashboards Built with Shadcn UI',
  description: 'Build circular pie charts and donut graphs with Shadcn UI components built with Tailwind React for dashboard proportional data representation.',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Shadcn Donughnut & Pie Chart',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Shadcn Donughnut & Pie Chart' items={BCrumb} />
      <div className='grid grid-cols-12 gap-5 sm:gap-7'>
        {/* intro */}
        {/* <div className='col-span-12'>
          <Intro detail={intro} />
        </div> */}
        {/* Default */}
        <div className='col-span-12'>
          <ChartPieSimple />
        </div>
        {/* Separator None */}
        <div className='col-span-12'>
          <ChartPieSeparatorNone />
        </div>
        {/* Label */}
        <div className='col-span-12'>
          <ChartPieLabel />
        </div>
        {/* Custom Label */}
        <div className='col-span-12'>
          <ChartPieLabelCustom />
        </div>
        {/* Label List */}
        <div className='col-span-12'>
          <ChartPieLabelList />
        </div>
        {/* Legend */}
        <div className='col-span-12'>
          <ChartPieLegend />
        </div>
        {/* Donut */}
        <div className='col-span-12'>
          <ChartPieDonut />
        </div>
        {/* Donut Active */}
        <div className='col-span-12'>
          <ChartPieDonutActive />
        </div>
        {/* Donut With Text */}
        <div className='col-span-12'>
          <ChartPieDonutText />
        </div>
        {/* Stacked */}
        <div className='col-span-12'>
          <ChartPieStacked />
        </div>
        {/* Interactive */}
        <div className='col-span-12'>
          <ChartPieInteractive />
        </div>
      </div>
    </>
  )
}

export default page
