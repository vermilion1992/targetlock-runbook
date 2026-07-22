import dynamic from "next/dynamic";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import AnimatedItem from "@/app/components/animated-components/ListAnimation";
import { ApexOptions } from "apexcharts";
// Load chart only on client side
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const WeeklyStats = () => {
  const chartOptions: ApexOptions = {
    series: [
      {
        name: "Sales Per Week",
        color: "var(--color-primary)",
        data: [5, 15, 10, 20],
      },
    ],
    chart: {
      id: "sparkline3",
      type: "area",
      height: 180,
      sparkline: {
        enabled: true,
      },
      group: "sparklines",
      fontFamily: "inherit",
      foreColor: "#adb0bb",
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.1,
        opacityTo: 0,
        stops: [20, 280],
      },
    },
    markers: {
      size: 0,
    },
    tooltip: {
      theme: "dark",
      fixed: {
        enabled: true,
        position: "right",
      },
      x: {
        show: false,
      },
    },
  };

  interface SalesItem {
    key: string;
    title: string;
    subtitle: string;
    badgeColor: BadgeProps["variant"];
    bgcolor: string;
  }

  const SalesData: SalesItem[] = [
    {
      key: "topSales",
      title: "Top Sales",
      subtitle: "Johnathan Doe",
      badgeColor: "lightPrimary",
      bgcolor: "bg-lightprimary text-primary",
    },
    {
      key: "topSeller",
      title: "Best Seller",
      subtitle: "MaterialPro Admin",
      badgeColor: "lightSuccess",
      bgcolor: "bg-lightsuccess text-success",
    },
    {
      key: "topCommented",
      title: "Most Commented",
      subtitle: "Ample Admin",
      badgeColor: "lightError",
      bgcolor: "bg-lighterror text-error",
    },
  ];

  return (
    <Card className="h-full">
      <div className="flex flex-col justify-between h-full">
        {/* Header */}
        <div>
          <h5 className="card-title">Weekly Stats</h5>
          <p className="card-subtitle">Average sales</p>
        </div>

        {/* Chart */}
        <div className="my-6">
          <Chart
            options={chartOptions}
            series={chartOptions.series}
            type="area"
            height="170px"
            width="100%"
          />
        </div>

        {/* Stats List with Scroll-Based Animation */}
        <div className="flex flex-col gap-6">
          {SalesData.map((item, index) => (
            <AnimatedItem key={item.key} index={index}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`${item.bgcolor} h-10 w-10 flex justify-center items-center rounded-md`}
                  >
                    <Icon icon="tabler:grid-dots" className="text-xl" />
                  </div>
                  <div>
                    <h6 className="text-base">{item.title}</h6>
                    <p className="dark:text-darklink">{item.subtitle}</p>
                  </div>
                </div>
                <Badge
                  variant={item.badgeColor}
                  className="py-1.1 rounded-md text-sm"
                >
                  +68
                </Badge>
              </div>
            </AnimatedItem>
          ))}
        </div>
      </div>
    </Card>
  );
};
