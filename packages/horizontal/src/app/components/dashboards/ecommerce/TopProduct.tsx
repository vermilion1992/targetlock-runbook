"use client";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/table";
import { Icon } from "@iconify/react/dist/iconify.js";
import Link from "next/link";
import PlaceholdersInput from "@/app/components/animated-components/AnimatedInputPlaceholder";
import { useMemo, useRef, useState } from "react";
import { motion, Variants, useInView } from "framer-motion";
import Image from "next/image";

// ✅ Animation Variants
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

// ✅ Sample Product Data
const PerformersData = [
  {
    key: "performerData1",
    productImg: "/images/products/teddybear.jpg",
    productname: "Cute Soft Teddybear",
    category: "Toys",
    date: "Tue, Sep 2 2025",
    stock: "In Stock",
    color: "lightSuccess",
    price: 285,
  },
  {
    key: "performerData2",
    productImg: "/images/products/advance-macbook.jpg",
    productname: "MacBook Air Pro",
    category: "Electronics",
    date: "Mon, Sep 1 2025",
    stock: "Out Of Stock",
    color: "lightError",
    price: 650,
  },
  {
    key: "performerData3",
    productImg: "/images/products/red-valvet-dress.jpg",
    productname: "Red Valvet Dress",
    category: "Fashion",
    date: "Thu, Aug 28 2025",
    stock: "In Stock",
    color: "lightSuccess",
    price: 150,
  },
  {
    key: "performerData4",
    productImg: "/images/products/super-games.jpg",
    productname: "Gaming Console",
    category: "Electronics",
    date: "Mon, Sep 1 2025",
    stock: "In Stock",
    color: "lightSuccess",
    price: 25,
  },
];

export const TopProduct = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"product" | "price">("product");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // ✅ Scroll Animation
  const tableRef = useRef(null);
  const isInView = useInView(tableRef, { once: true });

  // ✅ Derived + Filtered + Sorted Data
  const filteredData = useMemo(() => {
    const filtered = PerformersData.filter((item) =>
      item.productname.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "product") {
        return sortOrder === "asc"
          ? a.productname.localeCompare(b.productname)
          : b.productname.localeCompare(a.productname);
      } else {
        return sortOrder === "asc" ? a.price - b.price : b.price - a.price;
      }
    });

    return sorted;
  }, [searchQuery, sortBy, sortOrder]);

  // ✅ Sorting Triggers
  const sortByProduct = () => {
    setSortBy("product");
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const sortByPrice = () => {
    setSortBy("price");
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <Card className="h-full" ref={tableRef}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="card-title">Top Products</h5>
            <p className="card-subtitle">Best seller</p>
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
                  "Search Product...",
                  "Find top Performer...",
                  "Look up Products...",
                ]}
              />
            </div>
          </div>
        </div>
        {/* ✅ Table Section */}
        <div className="flex flex-col">
          <div className="-m-1.5 overflow-x-auto">
            <div className="p-1.5 min-w-full inline-block align-middle">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="ps-0 text-sm">
                        <button
                          onClick={sortByProduct}
                          className="hover:cursor-pointer flex items-center gap-1.5"
                        >
                          Product
                          <Icon
                            icon={"solar:sort-vertical-line-duotone"}
                            width={18}
                            height={18}
                          />
                        </button>
                      </TableHead>
                      <TableHead className="text-sm">Date</TableHead>
                      <TableHead className="text-sm">Status</TableHead>
                      <TableHead className="text-sm w-32">
                        <button
                          onClick={sortByPrice}
                          className="hover:cursor-pointer flex items-center gap-1.5 group"
                        >
                          Price
                          <Icon
                            icon={"solar:sort-vertical-line-duotone"}
                            width={18}
                            height={18}
                            className="hidden group-hover:block"
                          />
                        </button>
                      </TableHead>
                      <TableHead className="text-sm">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <motion.tbody
                    variants={tableVariants}
                    initial="hidden"
                    animate={isInView ? "show" : "hidden"}
                  >
                    {filteredData.map((item, index) => (
                      <motion.tr
                        key={index}
                        variants={rowVariants}
                        className="border-b border-ld transition-colors"
                      >
                        <TableCell className="whitespace-nowrap ps-0 min-w-[220px]">
                          <div className="flex gap-3 items-center">
                            <Image
                              src={item.productImg}
                              alt="icon"
                              className="h-12 w-12 rounded-md"
                              width={48}
                              height={48}
                            />
                            <div>
                              <h6 className="text-sm font-semibold">
                                {item.productname}
                              </h6>
                              <p>{item.category}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <p>{item.date}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={item.color as BadgeProps["variant"]}
                            className="text-sm"
                          >
                            {item.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <p>${item.price}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Icon
                                icon="tabler:dots-vertical"
                                className="text-muted dark:text-darklink hover:text-primary dark:hover:text-primary text-lg shrink-0 cursor-pointer"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" align="center">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={"/apps/ecommerce/list"}
                                  className="flex gap-2 items-center text-muted dark:text-darklink"
                                >
                                  <Icon
                                    icon="solar:pen-new-square-broken"
                                    className="text-base"
                                  />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={"/apps/ecommerce/list"}
                                  className="flex gap-2 items-center text-muted dark:text-darklink"
                                >
                                  <Icon
                                    icon="solar:trash-bin-minimalistic-outline"
                                    className="text-base"
                                  />
                                  Delete
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
