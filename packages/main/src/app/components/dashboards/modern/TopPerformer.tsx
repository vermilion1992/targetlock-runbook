"use client";

import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import Image from "next/image";
import { motion, Variants, useInView } from "framer-motion";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import PlaceholdersInput from "@/app/components/animated-components/AnimatedInputPlaceholder";

// ✅ Animation variants
const tableVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.2 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export const TopPerformer = () => {
  const tableRef = useRef(null);
  const isInView = useInView(tableRef, { once: true });

  const PerformersData = [
    {
      key: "performerData1",
      profileImg: "/images/profile/user-1.jpg",
      username: "Sunil Joshi",
      designation: "Web Designer",
      project: "Elite Admin",
      priority: "Low",
      color: "lightPrimary",
      budget: 3.9,
    },
    {
      key: "performerData2",
      profileImg: "/images/profile/user-2.jpg",
      username: "John Deo",
      designation: "Web Developer",
      project: "Flexy Admin",
      priority: "Medium",
      color: "lightWarning",
      budget: 24.5,
    },
    {
      key: "performerData3",
      profileImg: "/images/profile/user-3.jpg",
      username: "Nirav Joshi",
      designation: "Web Manager",
      project: "Material Pro",
      priority: "High",
      color: "lightError",
      budget: 12.8,
    },
    {
      key: "performerData4",
      profileImg: "/images/profile/user-4.jpg",
      username: "Yuvraj Sheth",
      designation: "Project Manager",
      project: "Xtreme Admin",
      priority: "Low",
      color: "lightPrimary",
      budget: 4.8,
    },
    {
      key: "performerData5",
      profileImg: "/images/profile/user-5.jpg",
      username: "Micheal Doe",
      designation: "Content Writer",
      project: "Helping Hands WP Theme",
      priority: "High",
      color: "lightError",
      budget: 9.3,
    },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [tableData, setTableData] = useState(PerformersData);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredData = useMemo(() => {
    return tableData.filter((item) =>
      item.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, tableData]);

  const sortByAssign = () => {
    const sorted = [...tableData].sort((a, b) =>
      sortOrder === "asc"
        ? a.username.localeCompare(b.username)
        : b.username.localeCompare(a.username)
    );
    setTableData(sorted);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const sortByProject = () => {
    const sorted = [...tableData].sort((a, b) =>
      sortOrder === "asc"
        ? a.project.localeCompare(b.project)
        : b.project.localeCompare(a.project)
    );
    setTableData(sorted);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const sortByPriority = () => {
    const priorityOrder = { High: 3, Medium: 2, Low: 1 };
    const sorted = [...tableData].sort((a, b) => {
      const aPriority =
        priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority =
        priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      return sortOrder === "asc"
        ? aPriority - bPriority
        : bPriority - aPriority;
    });
    setTableData(sorted);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const sortByBudget = () => {
    const sorted = [...tableData].sort((a, b) =>
      sortOrder === "asc" ? a.budget - b.budget : b.budget - a.budget
    );
    setTableData(sorted);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  return (
    <Card ref={tableRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h5 className="card-title">Top Performers</h5>
          <p className="card-subtitle">Best employees</p>
        </div>
        <div className="flex items-center">
          <div className="flex items-center relative">
            <Icon
              icon="solar:magnifer-line-duotone"
              height={18}
              width={18}
              className="absolute top-1/2 start-[15px] -translate-y-1/2"
            />
            <PlaceholdersInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholders={[
                "Search User...",
                "Find top Performer...",
                "Look up Users...",
              ]}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <SimpleBar className="-m-1.5 overflow-auto ">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="overflow-x-auto overflow-y-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-semibold ps-0">
                      <div
                        onClick={sortByAssign}
                        className="hover:cursor-pointer flex items-center gap-1.5"
                      >
                        Assigned
                        <span>
                          <Icon
                            icon={"solar:sort-vertical-line-duotone"}
                            width={18}
                            height={18}
                          />
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-sm font-semibold">
                      <div
                        onClick={sortByProject}
                        className="hover:cursor-pointer flex items-center gap-1.5 group"
                      >
                        Project
                        <span>
                          <Icon
                            icon={"solar:sort-vertical-line-duotone"}
                            width={18}
                            height={18}
                            className="hidden group-hover:block"
                          />
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-sm font-semibold">
                      <div
                        onClick={sortByPriority}
                        className="hover:cursor-pointer flex items-center gap-1.5 group"
                      >
                        Priority
                        <span>
                          <Icon
                            icon={"solar:sort-vertical-line-duotone"}
                            width={18}
                            height={18}
                            className="hidden group-hover:block"
                          />
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-sm font-semibold min-w-28">
                      <div
                        onClick={sortByBudget}
                        className="hover:cursor-pointer flex items-center gap-1.5 group"
                      >
                        Budget
                        <span>
                          <Icon
                            icon={"solar:sort-vertical-line-duotone"}
                            width={18}
                            height={18}
                            className="hidden group-hover:block"
                          />
                        </span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {/* ✅ Animated Table Body triggered only when in view */}
                <motion.tbody
                  className="divide-y divide-border dark:divide-darkborder"
                  variants={tableVariants}
                  initial="hidden"
                  animate={isInView ? "show" : "hidden"}
                >
                  {filteredData.map((item) => (
                    <motion.tr key={item.key} variants={rowVariants}>
                      <TableCell className="whitespace-nowrap ps-0 md:min-w-auto min-w-[200px]">
                        <div className="flex gap-3 items-center">
                          <Image
                            src={item.profileImg}
                            alt="icon"
                            className="h-8 w-8 rounded-full"
                            width={32}
                            height={32}
                          />
                          <div>
                            <h6 className="text-sm font-semibold mb-1">
                              {item.username}
                            </h6>
                            <p className="text-xs font-normal text-bodytext dark:text-darklink">
                              {item.designation}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="text-link dark:text-darklink text-sm w-fit">
                          {item.project}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={item.color as BadgeProps["variant"]}
                          className="text-sm"
                        >
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="dark:text-darklink text-link text-sm">
                          {item.budget}k
                        </p>
                      </TableCell>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </Table>
            </div>
          </div>
        </SimpleBar>
      </div>
    </Card>
  );
};
