"use client"
import { Card } from "@/components/ui/card";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
import { ApexOptions } from "apexcharts";
import { Icon } from "@iconify/react/dist/iconify.js";

export const IncrementedSales = () => {
    const ChartData: ApexOptions = {
        series: [
            {
                name: "",
                data: [100, 60, 35, 90, 35, 100]
            },
        ],
        chart: {
            type: 'bar',
            height: 25,
            fontFamily: "inherit",
            toolbar: {
                show: false
            },
            sparkline: {
                enabled: true
            },
            width: "100%",

        },
        colors: ["var(--color-primary)"],
        grid: {
            show: false,
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '50%',
                borderRadius: 4,
                distributed: true,
            }
        },
        dataLabels: {
            enabled: false
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
        fill: {
            opacity: 1
        },
        tooltip: {
            theme: 'dark',
            x: {
                show: false
            },
            y: {
                formatter: function (value: number) {
                    return `$${value.toLocaleString()}K`;
                }
            }
        },
    };

    return (
        <>
            <Card className="h-full">
                <div className="flex flex-col gap-4 justify-between">
                    <div className="flex 2xl:flex-row lg:flex-col-reverse flex-row 2xl:items-center lg:items-start items-center justify-between">
                        <div>
                            <h3 className="text-lg">
                                $16.5k
                            </h3>
                            <p className=" mt-1">Sales</p>
                        </div>
                        <div className="bg-lightprimary dark:bg-lightprimary rounded-md flex justify-center items-center text-primary p-2">
                            <Icon icon="solar:cart-4-bold-duotone" className='text-2xl' />
                        </div>
                    </div>
                    <div className="">
                        <Chart
                            options={ChartData}
                            series={ChartData.series}
                            type="bar"
                            width={"100%"}
                            height={"100px"}
                        />
                    </div>
                </div>
            </Card>
        </>
    )
}
