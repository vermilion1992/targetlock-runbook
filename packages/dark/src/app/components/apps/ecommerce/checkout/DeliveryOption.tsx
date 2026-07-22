import OutlineCard from "@/app/components/shared/OutlineCard";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import React, { useState } from "react";

const DeliveryOption = () => {
  const [selectedDelivery, setSelectedDelivery] = useState("delivery-free");

  return (
    <OutlineCard className="shadow-none">
      <h6 className="text-base mb-2">Delivery Option</h6>
      <RadioGroup
        value={selectedDelivery}
        onValueChange={(value) => setSelectedDelivery(value)}
        className="grid grid-cols-12 gap-5"
      >
        <div className="lg:col-span-6 col-span-12">
          <div
            className={`border border-ld p-4 rounded-md hover:border-primary hover:bg-lightprimary cursor-pointer ${selectedDelivery === "delivery-free"
                ? "bg-lightprimary border-primary"
                : ""
              }`}
          >
            <div className="flex items-center gap-4 sm:ps-2">
              <RadioGroupItem
                id="free"
                value="delivery-free"
                className="peer hidden"
              />
              <Label
                htmlFor="free"
                className="cursor-pointer peer-checked:[&_.delivery-content]:text-primary peer-checked:[&_.delivery-content]:font-semibold flex flex-col gap-2"
              >
                <span className="delivery-content text-ld font-semibold text-base">
                  Free Delivery
                </span>
                <span className="text-sm font-medium text-darklink">
                  Delivered on Friday, May 10
                </span>
              </Label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 col-span-12">
          <div
            className={`border border-ld p-4 rounded-md hover:border-primary hover:bg-lightprimary cursor-pointer ${selectedDelivery === "delivery-fast"
                ? "bg-lightprimary border-primary"
                : ""
              }`}
          >
            <div className="flex items-center gap-4 sm:ps-2">
              <RadioGroupItem
                id="fast"
                value="delivery-fast"
                className="peer hidden"
              />
              <Label
                htmlFor="fast"
                className="cursor-pointer peer-checked:[&_.delivery-content]:text-primary peer-checked:[&_.delivery-content]:font-semibold flex flex-col gap-2"
              >
                <span className="delivery-content text-ld font-semibold text-base">
                  Free Delivery
                </span>
                <span className="text-sm font-medium text-darklink">
                  Delivered on Wednesday, May 8
                </span>
              </Label>
            </div>
          </div>
        </div>
      </RadioGroup>
    </OutlineCard>
  );
};

export default DeliveryOption;
