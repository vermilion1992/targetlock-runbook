"use client";

import ProductFilter from "@/app/components/apps/ecommerce/productgrid/ProductFilter";
import ProductList from "@/app/components/apps/ecommerce/productgrid/ProductList";
import { Card } from "@/components/ui/card";
import { ProductProvider } from "@/app/context/ecommerce-context/index";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"; // <- ShadCN Sheet
import { useState } from "react";

const EcommerceShop = () => {
  const [isOpenShop, setIsOpenShop] = useState(false);

  return (
    <ProductProvider>
      <Card className="p-0">
        <div className="flex">
          {/* ------------------------------------------- */}
          {/* Left Filter Sidebar for mobile using Sheet */}
          {/* ------------------------------------------- */}
          <div className="lg:relative lg:block hidden max-w-[250px] w-full">
            <ProductFilter />
          </div>

          {/* Mobile Filter using Sheet/Drawer */}
          <Sheet open={isOpenShop} onOpenChange={setIsOpenShop}>
            <SheetContent side="left" className="w-[250px] p-0 lg:hidden">
              <ProductFilter />
            </SheetContent>
          </Sheet>

          {/* ------------------------------------------- */}
          {/* Product List */}
          {/* ------------------------------------------- */}
          <div className="p-6 w-full">
            <ProductList openShopFilter={setIsOpenShop} />
          </div>
        </div>
      </Card>
    </ProductProvider>
  );
};

export default EcommerceShop;
