import { Expense } from "@/app/components/dashboards/ecommerce/Expense";
import { IncrementedSales } from "@/app/components/dashboards/ecommerce/IncrementedSales";
import { MonthlyEarning } from "@/app/components/dashboards/ecommerce/MonthlyEarning";
import { PaymentGateway } from "@/app/components/dashboards/ecommerce/PaymentGateways";
import { RecentTransaction } from "@/app/components/dashboards/ecommerce/RecentTransaction";
import { Sales } from "@/app/components/dashboards/ecommerce/Sales";
import { SalesGrowth } from "@/app/components/dashboards/ecommerce/SalesGrowth";
import { TopProduct } from "@/app/components/dashboards/ecommerce/TopProduct";
import { QuarterlyStats } from "@/app/components/dashboards/ecommerce/QuarterlyStats";
import { WelcomeCard } from "@/app/components/dashboards/ecommerce/WelcomeCard";
import { YearlySales } from "@/app/components/dashboards/ecommerce/WeeklySales";
import CustomerSegmentation from "@/app/components/dashboards/ecommerce/CustomerSegmentation";
import UserActivity from "@/app/components/dashboards/ecommerce/UseActivity";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "eCommerce Admin Dashboard",
  description: "eCommerce template page",
};

const page = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="lg:col-span-8 col-span-12">
          <WelcomeCard />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="grid grid-cols-12 gap-6">
            <div className="sm:col-span-6 col-span-12">
              <Expense />
            </div>
            <div className="sm:col-span-6 col-span-12">
              <Sales />
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <UserActivity />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <CustomerSegmentation />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="grid grid-cols-12 gap-6">
            <div className="sm:col-span-6 col-span-12">
              <IncrementedSales />
            </div>
            <div className="sm:col-span-6 col-span-12">
              <SalesGrowth />
            </div>
          </div>
          <MonthlyEarning />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <QuarterlyStats />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <YearlySales />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <PaymentGateway />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <RecentTransaction />
        </div>
        <div className="lg:col-span-8 col-span-12">
          <TopProduct />
        </div>
      </div>
    </>
  );
};

export default page;
