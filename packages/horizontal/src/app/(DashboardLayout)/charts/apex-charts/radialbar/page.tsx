import { Metadata } from "next";
import BreadcrumbComp from "../../../layout/shared/breadcrumb/BreadcrumbComp";
import ApexRadialChart from "@/app/components/charts/apex-charts/ApexRadialBarChart";
import ApexRadarChart from "@/app/components/charts/apex-charts/ApexRadarChart";
import CodePreview from "@/app/components/shared/CodePreview";

export const metadata: Metadata = {
  title: "Radial Chart",
  description: "demo",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Chart Apex Radialbar & Radar",
  },
];

const RadialChart = () => {
  return (
    <>
      <BreadcrumbComp title="Chart Apex Radialbar & Radar" items={BCrumb} />
      <div className="flex flex-col gap-6">
        {/* Radialbar Chart */}
        <div>
          <CodePreview
            component={<ApexRadialChart />}
            filePath="src/app/components/charts/ApexCharts/ApexRadialBarChart.tsx"
            title="Radialbar Chart"
          />
        </div>
        {/* Radar Chart */}
        <div>
          <CodePreview
            component={<ApexRadarChart />}
            filePath="src/app/components/charts/ApexCharts/ApexRadarChart.tsx"
            title="Radar Chart"
          />
        </div>
      </div>
    </>
  );
};

export default RadialChart;
