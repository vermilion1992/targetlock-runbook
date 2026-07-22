'use client'

import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const ApexRadialChart = () => {
  const ChartData: ApexOptions = {
    series: [44, 55, 67, 83],
    chart: {
      type: 'radialBar',
      height: 300,
      fontFamily: `inherit`,
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
    },
    colors: [
      'var(--color-info)',
      'var(--color-primary)',
      'var(--color-error)',
      'var(--color-warning )',
    ],

    plotOptions: {
      radialBar: {
        dataLabels: {
          name: {
            fontSize: '22px',
          },
          value: {
            fontSize: '16px',
          },
          total: {
            show: true,
            label: 'Total',
            formatter() {
              return "249"
            },
          },
        },
      },
    },
  }

  return (
    <>
      <Chart
        options={ChartData}
        series={ChartData.series}
        type='radialBar'
        height='300px'
        width='100%'
      />
    </>
  )
}

export default ApexRadialChart
