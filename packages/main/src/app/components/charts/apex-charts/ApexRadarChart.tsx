'use client'

import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const ApexRadarChart = () => {
  const ChartData: ApexOptions = {
    series: [
      {
        name: 'Sales',
        data: [80, 50, 30, 40, 100, 20],
      },
    ],
    chart: {
      type: 'radar',
      height: 300,
      fontFamily: `inherit`,
      toolbar: {
        show: false,
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacityTo: 0.1,
        stops: [100],
      },
    },
    colors: ['var(--color-primary)'],
    labels: ['January', 'February', 'March', 'April', 'May', 'June'],
  }
  return (
    <>
      <Chart
        options={ChartData}
        series={ChartData.series}
        type='radar'
        height='300px'
        width='100%'
      />
    </>
  )
}

export default ApexRadarChart
