"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TbDotsVertical } from "react-icons/tb";
import { Icon } from "@iconify/react";
const SecurityTab = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="lg:col-span-8 col-span-12">
          <Card className="shadow-none">
            <h5 className="card-title mb-1">Two-factor Authentication</h5>
            <div className="flex gap-4 items-center mb-4">
              <div className="lg:flex gap-4 ">
                <p className="card-subtitle">
                  Lorem ipsum, dolor sit amet consectetur adipisicing elit.
                  Corporis sapiente sunt earum officiis laboriosam ut.
                </p>
                <Button className="lg:mt-0 mt-3">Enable</Button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ld pt-4">
              <div className="">
                <h6 className="text-base">Authentication App</h6>
                <p className="text-sm text-darklink">Google auth app</p>
              </div>
              <Button variant={"lightprimary"}>Setup</Button>
            </div>
            <div className="flex items-center justify-between border-t border-ld pt-4 mt-3">
              <div className="">
                <h6 className="text-base">Another e-mail</h6>
                <p className="text-sm text-darklink">
                  E-mail to send verification link
                </p>
              </div>
              <Button variant={"lightprimary"}>Setup</Button>
            </div>
            <div className="flex items-center justify-between border-t border-ld pt-4 mt-3">
              <div className="">
                <h6 className="text-base">SMS Recovery</h6>
                <p className="text-sm text-darklink">
                  Your phone number or something
                </p>
              </div>
              <Button variant={"lightprimary"}>Setup</Button>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <Card>
            <div className="flex justify-center h-12 w-12 rounded-md bg-lightgray dark:bg-darkmuted items-center text-ld">
              <Icon icon="solar:laptop-2-broken" height={20} className="text-primary" />
            </div>
            <h5 className="text-lg mt-1">Devices</h5>
            <p className="text-sm text-darklink -mt-1">
              Lorem ipsum dolor sit amet consectetur adipisicing elit Rem.
            </p>
            <Button className="w-fit mt-3">
              Sign out from all devices
            </Button>

            <div className="flex gap-3.5 items-center mt-6">
              <Icon icon="solar:smartphone-vibration-line-duotone" height={20} className="text-ld" />
              <div>
                <h6 className="text-base">iPhone 14</h6>
                <p className="text-sm text-darklink">London UK, Oct 23 at 1:15 AM</p>
              </div>
              <TbDotsVertical size={18} className="cursor-pointer ms-auto text-ld" />
            </div>
            <div className="flex gap-3.5 items-center border-t border-ld mt-2 pt-3">
              <Icon icon="solar:monitor-broken" height={20} className="text-ld" />
              <div>
                <h6 className="text-base">Macbook Air</h6>
                <p className="text-sm text-darklink">Gujarat India, Oct 24 at 3:15 AM</p>
              </div>
              <TbDotsVertical size={18} className="cursor-pointer ms-auto text-ld" />
            </div>
            <Button variant={'lightprimary'} className="mt-3">Need Help?</Button>
          </Card>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-7">
        <Button>Save</Button>
        <Button variant={"lighterror"}>Cancel</Button>
      </div>
    </>
  );
};

export default SecurityTab;
