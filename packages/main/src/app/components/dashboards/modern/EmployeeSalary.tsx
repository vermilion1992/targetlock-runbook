'use client'
import { Card } from '@/components/ui/card'
import dynamic from 'next/dynamic'
import { Icon } from '@iconify/react/dist/iconify.js'
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })
import { ApexOptions } from 'apexcharts'

const EmployeeSalary = () => {
  const ChartData: ApexOptions = {
    series: [
      {
        name: 'Employee Salary',
        data: [20, 15, 30, 25, 10, 15, 20],
      },
    ],
    chart: {
      toolbar: {
        show: false,
      },
      height: 260,
      type: 'bar',
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
    },
    colors: [
      'var(--color-lightprimary)',
      'var(--color-lightprimary)',
      'var(--color-primary)',
      'var(--color-lightprimary)',
      'var(--color-lightprimary)',
      'var(--color-lightprimary)',
      'var(--color-lightprimary)',
    ],
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%',
        distributed: true,
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
      xaxis: {
        lines: {
          show: false,
        },
      },
    },
    xaxis: {
      categories: [
        ['Apr'],
        ['May'],
        ['June'],
        ['July'],
        ['Aug'],
        ['Sept'],
        ['Oct'],
      ],
      axisBorder: {
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
      y: {
        formatter: function (value: number) {
          return `$${value.toLocaleString()}K`
        },
      },
    },
  }
  return (
    <>
      <Card className='p-6 flex flex-col justify-between h-full'>
        <div>
          <h5 className='card-title'>Employee Salary</h5>
          <p className='card-subtitle'>Every month</p>
        </div>
        <div>
          <Chart
            options={ChartData}
            series={ChartData.series}
            type='bar'
            height='285px'
          />
        </div>
        <div className='flex items-center justify-between'>
          <div className='flex gap-3 items-center'>
            <div className='bg-lightprimary dark:bg-darkprimary h-10 w-10 flex justify-center items-center rounded-md'>
              <Icon icon='tabler:grid-dots' className='text-primary text-xl' />
            </div>
            <div>
              <p className='dark:text-darklink '>Salary</p>
              <h6 className='text-base'>$36,358</h6>
            </div>
          </div>
          <div className='flex gap-3 items-center'>
            <div className='bg-lightgray dark:bg-darkgray h-10 w-10 flex justify-center items-center rounded-md'>
              <Icon
                icon='tabler:grid-dots'
                className='opacity-70 dark:opacity-100 text-xl'
              />
            </div>
            <div>
              <p className='dark:text-darklink '>Profit</p>
              <h6 className='text-base'>$5,296</h6>
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}
export { EmployeeSalary }
