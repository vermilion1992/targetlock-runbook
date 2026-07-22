'use client'

import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const ApexPieChart = () => {
  const ChartData: ApexOptions = {
    series: [44, 55, 13, 43, 22],
    chart: {
      type: 'pie',
      height: 300,
      fontFamily: `inherit`,
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70px',
        },
      },
    },
    legend: {
      show: true,
      position: 'bottom',
    },
    colors: [
      'var(--color-info)',
      'var(--color-primary)',
      'var(--color-error)',
      'var(--color-success)',
      'var(--color-warning )',
    ],
    tooltip: {
      fillSeriesColor: false,
    },
    stroke: {
      width: 2,
      colors: ['var(--color-surface-ld)'],
    },
    labels: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'],
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200,
          },
          legend: {
            position: 'bottom',
          },
        },
      },
    ],
  }
  return (
    <>
      <Chart
        options={ChartData}
        series={ChartData.series}
        type='pie'
        height='300px'
        width='100%'
      />
    </>
  )
}

export default ApexPieChart
