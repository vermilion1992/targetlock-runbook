"use client";


import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRef, useState } from "react";

export const PaymentGateway = () => {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const paymentGateways = [
    {
      key: "paymentOption1",
      paymentOption: "Paypal",
      desc: "Big Brands",
      amount: "+$450",
      paymentImg: '/images/svgs/icon-paypal2.svg',
      color: "bg-lightprimary dark:bg-lightprimary",
    },
    {
      key: "paymentOption2",
      paymentOption: "Wallet",
      desc: "Big Brands",
      paymentImg: '/images/svgs/icon-wallet.svg',
      amount: "+$345",
      color: "bg-lightsuccess dark:bg-lightsuccess",
    },
    {
      key: "paymentOption3",
      paymentOption: "Credit card",
      desc: "Money reversed",
      paymentImg: '/images/svgs/icon-credit-card.svg',
      amount: "+$2,235",
      color: "bg-lightwarning dark:bg-lightwarning",
    },
    {
      key: "paymentOption4",
      paymentOption: "Refund ",
      desc: "Bill payment",
      paymentImg: '/images/svgs/icon-pie2.svg',
      amount: "-$32",
      color: "bg-lighterror dark:bg-lighterror",
    },
  ];

  return (
    <Card className="h-full" ref={ref}>
      <div className="flex flex-col gap-6 justify-between h-full">
        {/* Header */}
        <div>
          <h5 className="card-title">Payment Gateways</h5>
          <p className="card-subtitle">Platform for income</p>
        </div>

        {/* Payment Entries */}
        <div className="flex flex-col gap-6">
          {paymentGateways.map((item, index) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.3 }}
              className="flex items-center justify-between"
            >
              <div className="flex gap-3 items-center">
                <div
                  className={`${item.color} rounded-md flex items-center justify-center h-11 w-11`}
                >
                  <Image
                    src={item.paymentImg}
                    alt={`${item.paymentOption} icon`}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </div>
                <div>
                  <h6 className="text-base">{item.paymentOption}</h6>
                  <p className="dark:text-darklink">{item.desc}</p>
                </div>
              </div>
              <p>{item.amount}</p>
            </motion.div>
          ))}
        </div>

        {/* Button */}
        <Button asChild variant={"outline"} className="hover:!bg-transparent">
          <motion.button
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className="relative overflow-hidden cursor-pointer"
          >
            {/* Liquid Fill Layer */}
            <motion.span
              initial={{ height: "0%" }}
              animate={{ height: hovered ? "100%" : "0%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 w-full bg-primary z-0"
            />

            {/* Button Text */}
            <Link href={"/frontend-pages/pricing"} className="relative z-10">
              View all transactions
            </Link>
          </motion.button>
        </Button>
      </div>
    </Card>
  );
};
