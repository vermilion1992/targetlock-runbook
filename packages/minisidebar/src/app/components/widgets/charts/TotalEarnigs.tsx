'use client'
import React from 'react'
import { Card } from '@/components/ui/card'
import dynamic from 'next/dynamic'
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

import { ApexOptions } from 'apexcharts'

const TotalEarningChart = () => {
  const ChartData: ApexOptions = {
    series: [
      {
        name: 'projects',
        data: [4, 10, 9, 7, 9, 10, 11, 8, 10, 12, 9],
      },
    ],
    chart: {
      type: 'bar',
      height: 55,
      fontFamily: `inherit`,
      sparkline: {
        enabled: true,
      },
    },
    colors: ['var(--color-secondary)'],

    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '60%',
        distributed: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2.5,
      colors: ['rgba(0,0,0,0.01)'],
    },
    xaxis: {
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        show: false,
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      theme: 'dark',
      x: {
        show: false,
      },
    },
  }
  return (
    <>
      <Card className='overflow-hidden'>
        <div className='flex justify-between items-end'>
          <div>
            <p className='card-subtitle'>Total Earning</p>
            <h5 className='card-title'>$78,298</h5>
          </div>
        </div>

        <Chart
          options={ChartData}
          series={ChartData.series}
          type='bar'
          height='55px'
          width='100%'
          className='mt-8'
        />
      </Card>
    </>
  )
}

export default TotalEarningChart
