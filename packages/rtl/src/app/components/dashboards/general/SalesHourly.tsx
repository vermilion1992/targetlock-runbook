"use client";

import { useContext } from "react";
import { CustomizerContext } from "@/app/context/customizer-context";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react/dist/iconify.js";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApexOptions } from "apexcharts";

export const SalesHourly = () => {
  const { activeMode } = useContext(CustomizerContext);
  const ChartData: ApexOptions = {
    series: [
      {
        name: "Checkout",
        data: [48, 48, 69, 60, 90, 113, 49],
      },
      {
        name: "Viewed",
        data: [35, 63, 77, 65, 51, 71, 61],
      },
    ],
    chart: {
      fontFamily: "inherit",
      foreColor: "#adb0bb",
      type: "bar",
      height: 250,
      stacked: true,
      offsetX: -5,
      toolbar: {
        show: false,
      },
    },
    grid: {
      show: false,
      borderColor: "rgba(0,0,0,0.1)",
      strokeDashArray: 1,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    colors: ["var(--color-primary)", "var(--color-secondary)"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "20%",
        borderRadius: 4,
        borderRadiusApplication: "around",
        borderRadiusWhenStacked: "all",
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: [["M"], ["T"], ["W"], ["T"], ["F"], ["S"], ["S"]],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: true,
      },
    },
    yaxis: {
      labels: {
        show: false,
      },
    },
    tooltip: {
      theme: `${activeMode === "light" ? "light" : "dark"}`,
    },
    legend: {
      show: false,
    },
  };
  return (
    <>
      <Card className="bg-lightprimary dark:bg-lightprimary p-0">
        <div className="flex justify-between items-center p-6">
          <div>
            <h4 className="card-title">Sales Weekly</h4>
            <p className="card-subtitle flex gap-2 items-center">
              <Icon
                icon="tabler:point-filled"
                className="text-primary text-xl"
              />
              Your data updates every Week
            </p>
          </div>
          <a href="/assets/weeklySales.csv" download>
            <Button color={"primary"}>
              <Icon icon="tabler:download" className="text-xl" />
            </Button>
          </a>
        </div>
        <Chart
          options={ChartData}
          series={ChartData.series}
          type="bar"
          height="255px"
          width="100%"
        />
      </Card>
    </>
  );
};
