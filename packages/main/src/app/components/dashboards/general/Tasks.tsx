"use client";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@iconify/react/dist/iconify.js";
import SimpleBar from "simplebar-react";
import { motion } from "framer-motion";

export const Tasks = () => {
    const tasksData = [
        {
            key: "task1",
            status: "Inprogress",
            date: "21 August 2025",
            title: "NFT Landing Page",
            description: "Designing an NFT-themed website with a creative concept that stands out...",
            tasks: 2,
            comments: 13,
            badgeColor: "lightPrimary",
        },
        {
            key: "task2",
            status: "Inpending",
            date: "28 August 2025",
            title: "NFT Dashboard Finance Management",
            description:
                "Managing NFT finance in a structured and visually appealing way...",
            tasks: 4,
            comments: 50,
            badgeColor: "lightError",
        },
        {
            key: "task3",
            status: "Completed",
            date: "12 Jul 2025",
            title: "NFT Logo Branding",
            description:
                "Designing a brand identity for NFT platforms and marketplaces...",
            tasks: 1,
            comments: 12,
            badgeColor: "lightSuccess",
        },
        {
            key: "task4",
            status: "Inprogress",
            date: "21 August 2025",
            title: "NFT Landing Page",
            description:
                "Creating an engaging and informative NFT landing experience...",
            tasks: 2,
            comments: 13,
            badgeColor: "lightPrimary",
        },
    ];

    return (
        <Card className="h-full">
            <div className="mb-5">
                <h4 className="card-title">Tasks</h4>
                <p className="card-subtitle">The power of prioritizing your tasks</p>
            </div>
            <SimpleBar className="max-h-[500px]">
                <div className="space-y-6">
                    {tasksData.map((item, i) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.2 }}
                            className="pb-6 border-b last:border-none border-border dark:border-darkborder"
                        >
                            <div className="flex items-center justify-between">
                                <Badge
                                    variant={item.badgeColor as BadgeProps["variant"]}
                                    className="rounded-md py-1.5 text-sm"
                                >
                                    {item.status}
                                </Badge>
                                <span className="text-sm">{item.date}</span>
                            </div>
                            <h6 className="mt-4 text-sm font-medium">{item.title}</h6>
                            <p className="pt-1 line-clamp-2">{item.description}</p>
                            <div className="flex gap-4 items-center mt-4">
                                <div className="flex gap-2 items-center">
                                    <Icon
                                        icon="tabler:clipboard"
                                        className="text-lg text-primary"
                                        aria-label="task count"
                                    />
                                    <span>{`${item.tasks} Tasks`}</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Icon
                                        icon="tabler:message-dots"
                                        className="text-lg text-primary"
                                        aria-label="comment count"
                                    />
                                    <span>{`${item.comments} Comments`}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </SimpleBar>
        </Card>
    );
};
