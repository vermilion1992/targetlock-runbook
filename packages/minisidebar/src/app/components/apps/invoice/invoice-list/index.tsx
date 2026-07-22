"use client";
import React, { useContext, useEffect, useState } from "react";
import { InvoiceContext } from "@/app/context/invoice-context/index";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AnimatedTableWrapper,
  AnimatedTableBody,
  AnimatedTableRow,
} from "@/app/components/animated-components/AnimatedTable";

// Datepicker
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import InputPlaceholderAnimate from "@/app/components/animated-components/AnimatedInputPlaceholder";

function InvoiceList() {
  const { invoices, deleteInvoice } = useContext(InvoiceContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All Invoice");
  const [selectedProducts, setSelectedProducts] = useState<any>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  //date
  const [createdDateFilter, setCreatedDateFilter] = useState<
    Date | undefined
  >();
  const [dueDateFilter, setDueDateFilter] = useState<Date | undefined>();

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.billFrom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.billTo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab =
      activeTab === "All Invoice" || invoice.status === activeTab;

    const matchesCreatedDate = createdDateFilter
      ? new Date(invoice.createdDate).toDateString() ===
        createdDateFilter.toDateString()
      : true;

    const matchesDueDate = dueDateFilter
      ? new Date(invoice.dueDate).toDateString() ===
        dueDateFilter.toDateString()
      : true;

    return matchesSearch && matchesTab && matchesCreatedDate && matchesDueDate;
  });
  // pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentInvoices = filteredInvoices.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName);
  };

  // Calculate the counts for different statuses
  const Paid = invoices.filter(
    (t: { status: string }) => t.status === "Paid"
  ).length;
  const Overdue = invoices.filter(
    (t: { status: string }) => t.status === "Overdue"
  ).length;
  const Pending = invoices.filter(
    (t: { status: string }) => t.status === "Pending"
  ).length;
  const Draft = invoices.filter(
    (t: { status: string }) => t.status === "Draft"
  ).length;

  // filter status wise
  const statusFilter = [
    {
      label: "All Invoice",
      count: invoices.length,
      bgcolor: "lightprimary",
      darkbgcolor: "darkprimary",
      txtcolor: "primary",
    },
    {
      label: "Paid",
      count: Paid,
      bgcolor: "lightsuccess",
      darkbgcolor: "lightsuccess",
      txtcolor: "success",
    },
    {
      label: "Overdue",
      count: Overdue,
      bgcolor: "lighterror",
      darkbgcolor: "lighterror",
      txtcolor: "error",
    },
    {
      label: "Pending",
      count: Pending,
      bgcolor: "lightwarning",
      darkbgcolor: "lightwarning",
      txtcolor: "warning",
    },
    {
      label: "Draft",
      count: Draft,
      bgcolor: "lightinfo",
      darkbgcolor: "lightinfo",
      txtcolor: "info",
    },
  ];

  // Handle opening delete confirmation dialog
  const handleDelete = () => {
    setOpenDeleteDialog(true);
  };

  // Handle confirming deletion of selected products
  const handleConfirmDelete = async () => {
    for (const productId of selectedProducts) {
      await deleteInvoice(productId);
    }
    setSelectedProducts([]);
    setSelectAll(false);
    setOpenDeleteDialog(false);
  };

  // Handle closing delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
  };

  // Reset Invoice on browser refresh
  const location = usePathname();
  const handleResetTickets = async () => {
    const response = await fetch("/api/invoice", {
      method: "GET",
      headers: {
        broserRefreshed: "true",
      },
    });
    const result = await response.json();
    await mutate("/api/invoice");
  };

  useEffect(() => {
    const isPageRefreshed = sessionStorage.getItem("isPageRefreshed");
    if (isPageRefreshed === "true") {
      console.log("page refreshed");
      sessionStorage.removeItem("isPageRefreshed");
      handleResetTickets();
    }
  }, [location]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("isPageRefreshed", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const safeFormatDate = (date: string | Date) => {
    if (!date) return "";
    if (typeof date === "string") {
      return format(new Date(date), "dd MMMM yyyy");
    }
    return format(date, "dd MMMM yyyy");
  };

  return (
    <div className="overflow-x-auto">
      {/* filter & add invoice */}
      <div className="flex lg:flex-row flex-col lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap lg:order-1 order-2">
          {statusFilter.map(
            ({ label, count, bgcolor, darkbgcolor, txtcolor }) => (
              <div
                key={label}
                className={`flex px-2 py-1.5 rounded-md items-center gap-2 ${
                  activeTab === label
                    ? "text-black dark:text-white bg-lightprimary dark:bg-darkprimary"
                    : "text-black/60 dark:text-white/60 hover:bg-lightprimary hover:dark:bg-darkprimary"
                } hover:cursor-pointer`}
                onClick={() => setActiveTab(label)}
              >
                <p className="text-sm font-medium">{label}</p>
                <p
                  className={`text-sm font-medium px-2.5 py-1 rounded-full bg-${bgcolor} dark:bg-${darkbgcolor} text-${txtcolor}`}
                >
                  {count}
                </p>
              </div>
            )
          )}
        </div>
        <div className="lg:order-2 order-1">
          <Button className="sm:w-fit w-full sm:mt-0 mt-4">
            <Link href="/apps/invoice/create">New Invoice</Link>
          </Button>
        </div>
      </div>
      {/* search & filter */}
      <div className="flex sm:flex-row flex-col item-center gap-2 my-6">
        <div className="relative">
          <Icon
            icon="solar:magnifer-line-duotone"
            height={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bodytext dark:text-darklink"
          />
          {/* <Input
            id='dis'
            type='text'
            className='!form-control pl-10'
            placeholder='search'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          /> */}
          <InputPlaceholderAnimate
            value={searchTerm}
            onChange={setSearchTerm}
            placeholders={[
              "Search bill...",
              "Find bill from...",
              "Look up bill to...",
            ]}
          />
        </div>
        {/* Created Date Picker */}
        <div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal border border-ld hover:bg-transparent hover:border-primary ${
                  !createdDateFilter
                    ? "text-muted-foreground hover:text-muted-foreground"
                    : "text-ld hover:text-ld"
                }`}
              >
                {createdDateFilter
                  ? format(createdDateFilter, "PPP")
                  : "Created Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={createdDateFilter}
                onSelect={setCreatedDateFilter}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        {/* Due Date Picker */}
        <div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal border border-ld hover:bg-transparent hover:border-primary ${
                  !dueDateFilter
                    ? "text-muted-foreground hover:text-muted-foreground"
                    : "text-ld hover:text-ld"
                }`}
              >
                {dueDateFilter ? format(dueDateFilter, "PPP") : "Due Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dueDateFilter}
                onSelect={setDueDateFilter}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <AnimatedTableWrapper className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={(checked) => {
                    const isChecked = Boolean(checked); // Ensure it's a boolean
                    setSelectAll(isChecked);
                    if (isChecked) {
                      setSelectedProducts(
                        filteredInvoices.map((invoice) => invoice.id)
                      );
                    } else {
                      setSelectedProducts([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>Id</TableHead>
              <TableHead>Bill From</TableHead>
              <TableHead>Bill To</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <AnimatedTableBody className="divide-y divide-border dark:divide-darkborder">
            {currentInvoices.map((invoice, index: number) => (
              <AnimatedTableRow key={invoice.id} index={index}>
                <TableCell className="p-4">
                  <Checkbox
                    checked={selectedProducts.includes(invoice.id)}
                    onCheckedChange={(checked) => {
                      const isChecked = Boolean(checked);
                      if (isChecked) {
                        setSelectedProducts((prev: any) => [
                          ...prev,
                          invoice.id,
                        ]);
                      } else {
                        setSelectedProducts((prev: any[]) =>
                          prev.filter((id: number) => id !== invoice.id)
                        );
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <h5 className="text-sm">{invoice.id}</h5>
                </TableCell>
                <TableCell>
                  <h5 className="text-sm">{invoice.billFrom}</h5>
                </TableCell>
                <TableCell className="text-ld">{invoice.billTo}</TableCell>
                <TableCell className="text-ld">{invoice.totalCost}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      invoice.status === "Paid"
                        ? "lightSuccess"
                        : invoice.status === "Overdue"
                        ? "lightError"
                        : invoice.status === "Draft"
                        ? "lightInfo"
                        : invoice.status === "Pending"
                        ? "lightWarning"
                        : "default"
                    }
                  >
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-ld">
                  {/* {format(new Date(invoice.createdDate), 'dd MMMM yyyy')} */}
                  {safeFormatDate(invoice.createdDate)}
                </TableCell>
                <TableCell className="text-ld">
                  {/* {format(new Date(invoice.dueDate), 'dd MMMM yyyy')} */}
                  {safeFormatDate(invoice.dueDate)}
                </TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <div className="flex justify-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={"lightsuccess"}
                            className="h-8 w-8 p-0 mb-2 group rounded-full"
                          >
                            <Link
                              href={`/apps/invoice/edit/${invoice.billFrom}`}
                            >
                              <Icon
                                icon="solar:pen-outline"
                                height={18}
                                className="group-hover:text-white"
                              />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Invoice</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={"lightprimary"}
                            className="h-8 w-8 p-0 mb-2 group rounded-full"
                          >
                            <Link
                              href={`/apps/invoice/detail/${invoice.billFrom}`}
                            >
                              <Icon
                                icon="solar:eye-outline"
                                height={18}
                                className="group-hover:text-white"
                              />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Invoice</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={"lighterror"}
                            className="h-8 w-8 p-0 mb-2 group rounded-full"
                            onClick={() => {
                              setSelectedProducts([invoice.id]);
                              handleDelete();
                            }}
                          >
                            <Icon
                              icon="solar:trash-bin-minimalistic-outline"
                              height={18}
                              className="group-hover:text-white"
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Invoice</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </TableCell>
              </AnimatedTableRow>
            ))}
          </AnimatedTableBody>
        </Table>
      </AnimatedTableWrapper>

      {/* pagination control */}
      <div className="flex items-center justify-between flex-wrap mt-6 lg:gap-0 gap-2">
        {/* Rows per page selector */}
        <div className="flex items-center gap-1">
          <p className="text-sm text-muted dark:text-lightgray">Show</p>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(value) => {
              setCurrentPage(1);
              setItemsPerPage(Number(value));
            }}
          >
            <SelectTrigger className="w-fit me-0" aria-label="Rows per page">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20].map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted dark:text-lightgray">per page</p>
        </div>

        {/* Page info and navigation */}
        <div className="flex items-center gap-5">
          <p className="text-sm font-normal text-muted dark:text-lightgray">
            {filteredInvoices.length === 0
              ? "0–0"
              : `${indexOfFirstItem + 1}-${Math.min(
                  indexOfLastItem,
                  filteredInvoices.length
                )}`}{" "}
            of {filteredInvoices.length}
          </p>
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:arrow-left-line-duotone"
              className={`text-dark dark:text-white hover:text-primary cursor-pointer ${
                currentPage === 1 ? "opacity-50 !cursor-not-allowed" : ""
              }`}
              width={20}
              height={20}
              onClick={() =>
                currentPage > 1 && setCurrentPage((prev) => prev - 1)
              }
            />
            <span className="w-8 h-8 bg-lightprimary text-primary flex items-center justify-center rounded-md dark:bg-darkprimary dark:text-white text-sm font-normal">
              {currentPage}
            </span>
            <Icon
              icon="solar:arrow-right-line-duotone"
              className={`text-dark dark:text-white hover:text-primary cursor-pointer ${
                currentPage === totalPages
                  ? "opacity-50 !cursor-not-allowed"
                  : ""
              }`}
              width={20}
              height={20}
              onClick={() =>
                currentPage < totalPages && setCurrentPage((prev) => prev + 1)
              }
            />
          </div>
        </div>
      </div>

      {/* delete modal */}
      <Dialog open={openDeleteDialog} onOpenChange={handleCloseDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-lg text-ld">
              Are you sure you want to delete selected products?
            </DialogTitle>
          </DialogHeader>

          <DialogFooter className="mx-auto">
            <Button variant="outline" onClick={handleCloseDeleteDialog}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InvoiceList;
