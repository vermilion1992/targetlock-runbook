import React from 'react'
import { Skeleton } from "@/components/ui/skeleton"


const CardSkeletonCode = () => {
  return (
  <>
  <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex flex-col space-y-3">
                    <Skeleton className="h-[125px] w-[250px] rounded-xl bg-gray-300 dark:bg-white/30" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px] bg-gray-300 dark:bg-white/30" />
                        <Skeleton className="h-4 w-[200px] bg-gray-300 dark:bg-white/30" />
                    </div>
                </div>
            </div>
  </>
  )
}

export default CardSkeletonCode