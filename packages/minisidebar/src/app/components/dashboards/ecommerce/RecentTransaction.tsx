"use client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import clsx from "clsx";

export const RecentTransaction = () => {
    const timelineRef = useRef(null);
    const isInView = useInView(timelineRef, { once: true });

    const timelineData = [
        {
            key: "timeline1",
            time: "08:45 am",
            desc: "Payment received from John Doe of $385.90",
            isSale: false,
            borderColor: "border-primary",
            isLastItem: false,
        },
        {
            key: "timeline2",
            time: "09:30 am",
            desc: "New sale recorded",
            isSale: true,
            borderColor: "border-info",
            isLastItem: false,
            saleId: "ML-3467",
        },
        {
            key: "timeline3",
            time: "10:00 am",
            desc: "Payment was made of $64.95 to Michael",
            isSale: false,
            borderColor: "border-success",
            isLastItem: false,
        },
        {
            key: "timeline4",
            time: "12:00 pm",
            desc: "New sale recorded",
            isSale: true,
            borderColor: "border-warning",
            isLastItem: false,
            saleId: "ML-3468",
        },
        {
            key: "timeline5",
            time: "03:00 pm",
            desc: "New sale recorded",
            isSale: true,
            borderColor: "border-error",
            isLastItem: false,
            saleId: "ML-3469",
        },
        {
            key: "timeline6",
            time: "04:45 pm",
            desc: "Payment Done",
            isSale: false,
            borderColor: "border-success",
            isLastItem: true,
        },
    ];

    return (
        <Card className="h-full" ref={timelineRef}>
            <h5 className="card-title">Recent Transactions</h5>
            <p className="card-subtitle">How to secure recent transactions</p>
            <div className="mt-6">
                {timelineData.map((item, i) => (
                    <motion.div
                        key={item.key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{
                            duration: 0.5,
                            delay: isInView ? i * 0.2 : 0,
                        }}
                        className="flex gap-x-3"
                    >
                        {/* Time */}
                        <div className="w-1/4 text-end">
                            <span className="text-sm text-muted-foreground">{item.time}</span>
                        </div>

                        {/* Timeline dot & line */}
                        <div
                            className={clsx(
                                "relative after:absolute after:top-7 after:bottom-0 after:start-3.5 after:w-px after:-translate-x-[0.5px] after:bg-border dark:after:bg-darkborder",
                                {
                                    "after:hidden": item.isLastItem,
                                }
                            )}
                        >
                            <div className="relative z-[1] w-7 h-7 flex justify-center items-center">
                                <div
                                    className={clsx(
                                        "h-3 w-3 rounded-full bg-transparent border-2",
                                        item.borderColor
                                    )}
                                ></div>
                            </div>
                        </div>

                        {/* Content */}
                        <div
                            className={clsx("w-1/4 grow pt-0.5", {
                                "pb-6": !item.isLastItem,
                                "pb-0": item.isLastItem,
                            })}
                        >
                            {!item.isSale ? (
                                <p>{item.desc}</p>
                            ) : (
                                <div>
                                    <h6>{item.desc}</h6>
                                    {item.saleId && (
                                        <Link href="#" className="text-primary text-sm">
                                            #{item.saleId}
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </Card>
    );
};
