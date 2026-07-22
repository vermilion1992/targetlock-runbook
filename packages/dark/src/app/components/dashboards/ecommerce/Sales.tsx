"use client"
import { Card } from "@/components/ui/card";
import { Icon } from "@iconify/react/dist/iconify.js";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
import { ApexOptions } from "apexcharts";

const Sales = () => {

  const ChartData: ApexOptions = {
    series: [
      {
        name: 'PRODUCT A',
        data: [11, 17, 15, 15, 21, 14, 11,]
      }
    ],
    colors: ["var(--color-secondary)"],
    grid: {
      show: false,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "30%",
        borderRadius: 3,
        borderRadiusApplication: 'around',
        borderRadiusWhenStacked: 'all',
      }
    },
    dataLabels: {
      enabled: false
    },
    chart: {
      type: 'bar',
      height: 100,
      stacked: false,
      toolbar: {
        show: false
      },
      sparkline: {
        enabled: true
      }
    },
    xaxis: {
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        show: false
      }
    },
    yaxis: {
      labels: {
        show: false
      }
    },
    legend: {
      show: false,
    },
    fill: {
      opacity: 1
    },
    tooltip: {
      theme: 'dark',
      x: {
        show: false
      }
    },
  };

  return (
    <>
      <Card className="h-full">
        <div className="flex flex-col gap-4">
          <div className="flex 2xl:flex-row lg:flex-col-reverse flex-row 2xl:items-center lg:items-start items-center justify-between">
            <div>
              <h4 className="text-lg">$65,432</h4>
              <p>Sales</p>
            </div>
            <div className="p-2 bg-lightsecondary dark:bg-lightsecondary rounded-md flex justify-center items-center text-secondary">
              <Icon icon="solar:wallet-money-bold-duotone" className='text-2xl' />
            </div>
          </div>
          <div className="rounded-bars -ms-3 -me-2">
            <Chart
              options={ChartData}
              series={ChartData.series}
              type="bar"
              height={'100px'}
            />
          </div>
        </div>
      </Card>
    </>
  )
}
export { Sales }