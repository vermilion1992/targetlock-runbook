import React from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

const BasicCollapseCode = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  return (
    <>
      <div>
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className='w-full space-y-2'>
          <div className='flex items-center justify-between space-x-4 '>
            <h4 className='text-ld text-15 font-medium'>
              @peduarte starred 3 repositories
            </h4>
            <CollapsibleTrigger asChild>
              <Button variant='ghost' size='sm' className='w-9 p-0'>
                <ChevronsUpDown className='h-4 w-4' />
                <span className='sr-only'>Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <div className='rounded-md border border-ld px-4 py-3 text-sm text-darklink dark:text-bodytext'>
            @radix-ui/primitives
          </div>
          <CollapsibleContent className='space-y-2'>
            <div className='rounded-md border border-ld px-4 py-3 text-sm text-darklink dark:text-bodytext'>
              @radix-ui/colors
            </div>
            <div className='rounded-md border border-ld px-4 py-3 text-sm text-darklink dark:text-bodytext'>
              @stitches/react
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </>
  )
}

export default BasicCollapseCode
