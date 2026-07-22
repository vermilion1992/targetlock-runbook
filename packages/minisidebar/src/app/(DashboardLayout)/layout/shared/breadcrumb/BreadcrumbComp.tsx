import { Card } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

interface BreadcrumbItem {
  title: string
  to?: string
}

interface BreadCrumbType {
  subtitle?: string
  items?: BreadcrumbItem[]
  title: string
}

const BreadcrumbComp = ({ title, items }: BreadCrumbType) => {
  return (
    <>
      <Card
        className={`mb-6 py-4 bg-lightsecondary dark:bg-lightsecondary overflow-hidden rounded-md border-none !shadow-none dark:!shadow-none`}>
        <div className='flex items-center justify-between gap-6 relative'>
          <div>
            <h4 className='font-semibold text-xl text-dark dark:text-white mb-3'>
              {title}
            </h4>
            <ol
              className='flex items-center whitespace-nowrap'
              aria-label='Breadcrumb'>
              {items ? (
                items.map((item: BreadcrumbItem, index: number) => (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <li>
                        <div className='p-0.5 rounded-full bg-link dark:bg-darklink mx-2.5 flex items-center'></div>
                      </li>
                    )}
                    <li
                      className={`flex items-center text-sm leading-none font-medium ${
                        index === items.length - 1
                          ? 'text-primary dark:text-primary'
                          : 'text-link dark:text-darklink opacity-80'
                      }`}
                      aria-current={
                        index === items.length - 1 ? 'page' : undefined
                      }>
                      {item.to ? (
                        <Link href={item.to}>{item.title}</Link>
                      ) : (
                        item.title
                      )}
                    </li>
                  </React.Fragment>
                ))
              ) : (
                <>
                  <li className='flex items-center'>
                    <Link
                      className='opacity-80 text-sm text-link dark:text-darklink leading-none font-medium'
                      href='/'>
                      Home
                    </Link>
                  </li>
                  <li>
                    <div className='p-0.5 rounded-full bg-link dark:bg-darklink mx-2.5 flex items-center'></div>
                  </li>
                  <li
                    className='flex items-center text-sm text-primary leading-none font-medium'
                    aria-current='page'>
                    {title}
                  </li>
                </>
              )}
            </ol>
          </div>
          <div className='absolute -top-6.5 right-0 max-h-[95px] max-w-[145px]  hidden sm:block breadcrumbImage'>
            <Image
              src={'/images/breadcrumb/customer-support-img.png'}
              alt='customer-support-img'
              width={145}
              height={95}
              className='h-full w-full object-contain'
            />
          </div>
        </div>
      </Card>
    </>
  )
}

export default BreadcrumbComp
