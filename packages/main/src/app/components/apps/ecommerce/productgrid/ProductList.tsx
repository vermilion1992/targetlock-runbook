"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import React, { useState, useContext, SetStateAction, Dispatch } from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import ProductSearch from "./ProductSearch";
import { ProductContext } from "@/app/context/ecommerce-context/index";
import RatingStars from "@/app/components/shared/RatingStars";

type ShopProps = {
  openShopFilter: Dispatch<SetStateAction<boolean>>; // or specify the exact type of the function
};

const ProductList = ({ openShopFilter }: ShopProps) => {
  const { filteredAndSortedProducts, addToCart, filterReset } =
    useContext(ProductContext);
  const [cartAlert, setCartAlert] = useState(false);
  const handleClick = () => {
    setCartAlert(true);
    setTimeout(() => {
      setCartAlert(false);
    }, 3000);
  };

  return (
    <>
      {/* Search Products */}
      <ProductSearch onClickFilter={() => openShopFilter(true)} />
      <div className="grid grid-cols-12 gap-6 mt-6">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => (
            <div
              className="lg:col-span-4 md:col-span-6 col-span-12"
              key={product.id}
            >
              <Card className="p-0 overflow-hidden group card-hover">
                <div className="relative">
                  <Link href={`/apps/ecommerce/detail/${product.id}`}>
                    <div className="overflow-hidden h-[265px] w-full">
                      <Image
                        src={product.photo}
                        alt="tailwind-admin"
                        height={265}
                        width={500}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </Link>
                  <div className="p-6 pt-4">
                    <div className="flex justify-between items-center -mt-8 relative">
                      <div className="ms-auto">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                className="btn-circle ms-auto p-0 rounded-full"
                                onClick={() => {
                                  addToCart(product.id);
                                  handleClick();
                                }}
                              >
                                <Icon icon="tabler:basket" height={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add To Cart</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <h6 className="text-base line-clamp-1 group-hover:text-primary">
                      {product.title}
                    </h6>
                    <div className="flex justify-between items-center mt-1">
                      <h5 className="text-base flex gap-2 items-center">
                        ${product.price}{" "}
                        <span className="font-normal text-sm text-darklink line-through">
                          ${product.salesPrice}
                        </span>
                      </h5>
                      <RatingStars rating={product.rating} />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))
        ) : (
          <>
            <div className="col-span-12">
              <div className="flex justify-center text-center">
                <div>
                  <Image
                    src={"/images/backgrounds/empty-shopping-cart.svg"}
                    alt="no product"
                    width={350}
                    height={350}
                  />
                  <h2 className="text-2xl">There is no Product</h2>
                  <p className="text-darklink my-3">
                    The product you are searching for is no longer available.
                  </p>
                  <Button
                    className="w-fit px-4 mx-auto rounded-md"
                    onClick={filterReset}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {cartAlert && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs">
          <Alert
            variant="primary"
            className="w-full text-center rounded flex items-center justify-center gap-2"
          >
            <Icon
              icon="solar:archive-minimalistic-broken"
              height={18}
              width={18}
            />
            <AlertDescription>Item Added to the Cart!!!</AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};

export default ProductList;
