import { FinancialIncomeCard } from "@/app/components/dashboards/general/FinancialIncomeCard";
import { OrderStatus } from "@/app/components/dashboards/general/OrderStatus";
import { Tasks } from "@/app/components/dashboards/general/Tasks";
import { TopPerformers } from "@/app/components/dashboards/general/TopPerformers";
import { UpcomingActivity } from "@/app/components/dashboards/general/UpcomingActivity";
import ProductCarousel from "@/app/components/dashboards/general/Productcarousel";
import TotalAssets from "@/app/components/dashboards/general/TotalAssets";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "General Admin Dashboard",
  description: "General template page",
};

const page = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <FinancialIncomeCard />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <UpcomingActivity />
        </div>
        <div className="lg:col-span-5 col-span-12">
          <TotalAssets />
        </div>
        <div className="lg:col-span-3 col-span-12">
          <ProductCarousel />
        </div>
        <div className="col-span-12">
          <OrderStatus />
        </div>
        <div className="lg:col-span-5 col-span-12">
          <Tasks />
        </div>
        <div className="lg:col-span-7 col-span-12">
          <TopPerformers />
        </div>
      </div>
    </>
  );
};

export default page;
