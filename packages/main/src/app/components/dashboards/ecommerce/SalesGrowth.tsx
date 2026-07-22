"use client"

import { Card } from "@/components/ui/card"
import dynamic from "next/dynamic"
import { Icon } from "@iconify/react"
import { ApexOptions } from "apexcharts"

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false })

export const SalesGrowth = () => {
  const series = [
    {
      name: "Sales",
      data: [0, 10, 10, 10, 35, 45, 30, 30, 30, 50, 52, 30, 25, 45, 50, 80, 60, 65],
    },
  ]

  const options: ApexOptions = {
    chart: {
      id: "growth",
      type: "area",
      height: 25,
      sparkline: {
        enabled: true,
      },
      group: "growth",
      fontFamily: "inherit",
      foreColor: "#adb0bb",
    },

    colors: ["var(--color-primary)"],

    stroke: {
      curve: "smooth",
      width: 2,
    },

    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0,
        opacityTo: 0,
        stops: [20, 280],
      },
    },

    markers: {
      size: 0,
    },

    tooltip: {
      theme: "dark",
      fillSeriesColor: false,
      y: {
        formatter: (value: number) => `$${value.toLocaleString()}K`,
      },
    },
  }

  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4">
        <div className="flex 2xl:flex-row lg:flex-col-reverse flex-row 2xl:items-center lg:items-start items-center justify-between">
          <div>
            <h3 className="text-lg">$16.5k</h3>
            <p className="mt-1">Growth</p>
          </div>

          <div className="p-2 bg-lightsecondary dark:bg-lightsecondary rounded-md flex justify-center items-center text-secondary">
            <Icon icon="solar:chart-2-bold-duotone" className="text-2xl" />
          </div>
        </div>

        <Chart
          options={options}
          series={series}
          type="area"
          width="100%"
          height={100}
        />
      </div>
    </Card>
  )
}
