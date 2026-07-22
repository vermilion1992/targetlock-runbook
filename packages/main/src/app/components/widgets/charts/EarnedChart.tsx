'use client'
import React from 'react'
import { Card } from '@/components/ui/card'
import dynamic from 'next/dynamic'
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

import { ApexOptions } from 'apexcharts'

const EarnedChart = () => {
  const ChartData: ApexOptions = {
    series: [
      {
        name: '',
        data: [0, 3, 1, 2, 8, 1, 5, 1],
      },
    ],
    chart: {
      type: 'area',
      fontFamily: `inherit`,
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
      group: 'sparklines',
    },
    colors: ['var(--color-primary)'],
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacityTo: 0.8,
        stops: [100],
      },
    },
    tooltip: {
      theme: 'dark',
      x: {
        format: 'dd/MM/yy HH:mm',
      },
    },
  }
  return (
    <>
      <Card className='p-0 overflow-hidden'>
        <div className='flex justify-between p-6 items-end'>
          <div>
            <h5 className='card-title'>2,545</h5>
            <p className='card-subtitle'>Earned</p>
          </div>
          <span className='text-success text-sm'>+1.20%</span>
        </div>

        <Chart
          options={ChartData}
          series={ChartData.series}
          type='area'
          height='90px'
          width='100%'
        />
      </Card>
    </>
  )
}

export default EarnedChart
