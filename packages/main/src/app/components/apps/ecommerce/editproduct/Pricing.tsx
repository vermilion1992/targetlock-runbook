"use client";
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const Pricing = () => {
  const [discountType, setDiscountType] = useState("no-discount");
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [fixedPrice, setFixedPrice] = useState("140");
  const [taxClass, setTaxClass] = useState("");
  const [vatAmount, setVatAmount] = useState("35");

  const handleDiscountChange = (value: string) => {
    setDiscountType(value);
  };

  return (
    <>
      <Card>
        <h5 className="card-title mb-4">Pricing</h5>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="prednm">Base Price</Label>
            <span className="text-error ms-1">*</span>
          </div>
          <Input
            id="prednm"
            type="text"
            className="form-control"
            placeholder="Product Price"
            value="150"
            readOnly
          />
          <small className="text-xs text-darklink">Set the product price.</small>
        </div>

        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="disctype">Discount Type</Label>
          </div>

          <RadioGroup
            onValueChange={handleDiscountChange}
            value={discountType}
            className="grid grid-cols-12 gap-6"
          >
            <div className="lg:col-span-4 col-span-12">
              <div className="border border-ld p-4 rounded-md hover:border-primary hover:bg-lightprimary cursor-pointer flex items-center gap-4 sm:ps-2">
                <RadioGroupItem
                  id="no-discount"
                  value="no-discount"
                  className="cursor-pointer"
                />
                <Label
                  htmlFor="no-discount"
                  className="cursor-pointer text-ld font-semibold text-base mb-0"
                >
                  No Discount
                </Label>
              </div>
            </div>

            <div className="lg:col-span-4 col-span-12">
              <div className="border border-ld p-4 rounded-md hover:border-primary hover:bg-lightprimary cursor-pointer flex items-center gap-4 sm:ps-2">
                <RadioGroupItem
                  id="percentage"
                  value="percentage"
                  className="cursor-pointer"
                />
                <Label
                  htmlFor="percentage"
                  className="cursor-pointer text-ld font-semibold text-base mb-0"
                >
                  Percentage %
                </Label>
              </div>
            </div>

            <div className="lg:col-span-4 col-span-12">
              <div className="border border-ld p-4 rounded-md hover:border-primary hover:bg-lightprimary cursor-pointer flex items-center gap-4 sm:ps-2">
                <RadioGroupItem
                  id="fixed-price"
                  value="fixed-price"
                  className="cursor-pointer"
                />
                <Label
                  htmlFor="fixed-price"
                  className="cursor-pointer text-ld font-semibold text-base mb-0"
                >
                  Fixed Price
                </Label>
              </div>
            </div>
          </RadioGroup>

          {discountType === "percentage" && (
            <div className="col-span-12 my-6">
              <div>
                <div className="mb-1 block">
                  <Label htmlFor="default-range">Set Discount Percentage</Label>
                </div>
                <Slider defaultValue={[discountPercentage]} max={100} step={1} id="default-range" />
              </div>
              <small className="text-xs text-darklink">
                Set a percentage discount to be applied on this product.
              </small>
            </div>
          )}

          {discountType === "fixed-price" && (
            <div className="col-span-12 my-6">
              <div className="">
                <div className="mb-2 block">
                  <Label htmlFor="dis">Fixed Discounted Price</Label>
                  <span className="text-error ms-1">*</span>
                </div>
                <Input
                  id="dis"
                  type="text"
                  value={fixedPrice}
                  className="form-control"
                  placeholder="Discounted Price"
                  onChange={(e) => setFixedPrice(e.target.value)}
                />
                <small className="text-xs text-darklink">
                  Set the discounted product price. The product will be reduced
                  at the determined fixed price.
                </small>
              </div>
            </div>
          )}

          <div className="grid grid-cols-12 gap-6 mt-8">
            <div className="lg:col-span-6 col-span-12">
              <div className="">
                <div className="mb-2 block">
                  <Label htmlFor="tax">Tax Class</Label>
                  <span className="text-error ms-1">*</span>
                </div>
                <Select
                  value={taxClass}
                  onValueChange={setTaxClass}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax-free">Tax Free</SelectItem>
                    <SelectItem value="taxable-goods">Taxable Goods</SelectItem>
                    <SelectItem value="downloadable-products">
                      Downloadable Products
                    </SelectItem>
                  </SelectContent>
                </Select>
                <small className="text-xs text-darklink">
                  Set the product tax class.
                </small>
              </div>
            </div>

            <div className="lg:col-span-6 col-span-12">
              <div className="">
                <div className="mb-2 block">
                  <Label htmlFor="vat">VAT Amount (%)</Label>
                  <span className="text-error ms-1">*</span>
                </div>
                <Input
                  id="vat"
                  type="text"
                  className="form-control"
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                />
                <small className="text-xs text-darklink">
                  Set the product VAT amount.
                </small>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export default Pricing;
