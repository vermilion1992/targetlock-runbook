import React from 'react'
import { Skeleton } from "@/components/ui/skeleton"

const BasicSkeletonCode = () => {
  return (
    <>
    <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full bg-gray-300 dark:bg-white/30" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px] bg-gray-300 dark:bg-white/30" />
                        <Skeleton className="h-4 w-[200px] bg-gray-300 dark:bg-white/30" />
                    </div>
                </div>
            </div>
    </>
  )
}

export default BasicSkeletonCode