import React from 'react'
import { badgeVariants } from '@/components/ui/badge'
import Link from 'next/link'

const LinkBadgeCode = () => {
  return (
    <>
    <div className="flex items-center flex-wrap gap-3 mt-4">
            <Link href="/ui-components/badge" className={badgeVariants({ variant: "default" })}>Badge Link 1</Link>
            <Link href="/ui-components/badge" className={badgeVariants({ variant: "secondary" })}>Badge Link 2</Link>
            <Link href="/ui-components/badge" className={badgeVariants({ variant: "success" })}>Badge Link 3</Link>
            <Link href="/ui-components/badge" className={badgeVariants({ variant: "warning" })}>Badge Link 4</Link>
            <Link href="/ui-components/badge" className={badgeVariants({ variant: "error" })}>Badge Link 5</Link>
            <Link href="/ui-components/badge" className={badgeVariants({ variant: "info" })}>Badge Link 6</Link>
            </div>
    </>
  )
}

export default LinkBadgeCode