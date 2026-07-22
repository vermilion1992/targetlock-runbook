import React from 'react'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ChevronDownIcon, Slash } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const BreadcrumbWithDropdownCode = () => {
  return (
    <>
    <div className="flex flex-wrap items-center gap-3 mt-4">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="/">Home</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator>
                            <Slash />
                        </BreadcrumbSeparator>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1">
                                Components
                                <ChevronDownIcon size={18} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" >
                                <DropdownMenuItem >Documentation</DropdownMenuItem>
                                <DropdownMenuItem >Themes</DropdownMenuItem>
                                <DropdownMenuItem >GitHub</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <BreadcrumbSeparator>
                            <Slash />
                        </BreadcrumbSeparator>
                        <BreadcrumbItem>
                            <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
    </>
  )
}

export default BreadcrumbWithDropdownCode