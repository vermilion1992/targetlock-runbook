import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  'flex h-10 w-full border rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:rounded-sm file:text-sm file:font-medium file:text-primary file:bg-lightprimary  focus-visible:outline-0',
  {
    variants: {
      variant: {
        default:
          'border-ld bg-transparent text-ld placeholder:text-bodytext dark:placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-0',
        gray: 'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500 focus-visible:ring',
        info: 'border-info bg-lightinfo text-info placeholder-info/80 focus:border-info focus:ring-info dark:border-info dark:bg-lightinfo dark:focus:border-info dark:focus:ring-info focus-visible:ring',
        failure:
          'border-error bg-lighterror text-error placeholder-error/80 focus:border-error focus:ring-error dark:border-error dark:bg-lighterror dark:focus:border-error dark:focus:ring-error focus-visible:ring',
        warning:
          'border-warning bg-lightwarning text-warning placeholder-warning/80 focus:border-warning focus:ring-warning dark:border-warning dark:bg-lightwarning dark:focus:border-warning dark:focus:ring-warning focus-visible:ring',
        success:
          'border-success bg-lightsuccess text-success placeholder-success/80 focus:border-success focus:ring-success dark:border-success dark:bg-lightsuccess dark:focus:border-success dark:focus:ring-success focus-visible:ring',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
  VariantProps<typeof inputVariants> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }