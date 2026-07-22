'use client'
import React from 'react'
import { Card } from '@/components/ui/card'
import dynamic from 'next/dynamic'
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })
import { Icon } from '@iconify/react'

import { ApexOptions } from 'apexcharts'

const Projects = () => {
  const ChartData: ApexOptions = {
    series: [
      {
        name: '',
        data: [4, 10, 9, 7, 9, 10],
      },
    ],

    chart: {
      toolbar: {
        show: false,
      },
      height: 75,
      type: 'bar',
      sparkline: {
        enabled: true,
      },
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
      offsetX: -5,
    },
    colors: [
      'var(--color-primary)',
      'var(--color-primary)',
      'var(--color-primary)',
      'var(--color-primary)',
      'var(--color-primary)',
      'var(--color-primary)',
    ],
    plotOptions: {
      bar: {
        borderRadius: 2,
        columnWidth: '40%',
        distributed: true,
        borderRadiusApplication: 'end',
      },
    },

    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    grid: {
      yaxis: {
        lines: {
          show: false,
        },
      },
    },
    xaxis: {
      axisBorder: {
        show: false,
      },
      labels: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        show: false,
      },
    },
    tooltip: {
      theme: 'dark',
    },
  }
  return (
    <>
      <Card className='overflow-hidden'>
        <div>
          <p className='text-subtitle'>Projects</p>
          <h5 className='text-xl'>78,298</h5>
          <div className='flex items-center mt-1 gap-1.5'>
            <span className='rounded-full p-1 bg-lightsuccess dark:bg-lightsuccess text-success flex items-center justify-center '>
              <Icon icon='solar:arrow-left-up-outline' height={15} />
            </span>
            <p className='text-ld text-sm mb-0'>+9%</p>
          </div>
        </div>

        <div className='rounded-bars mt-2'>
          <Chart
            options={ChartData}
            series={ChartData.series}
            type='bar'
            height='75px'
            width='100%'
          />
        </div>
      </Card>
    </>
  )
}

export default Projects
