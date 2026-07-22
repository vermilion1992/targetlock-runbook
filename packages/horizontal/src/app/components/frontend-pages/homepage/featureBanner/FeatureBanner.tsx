import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'

export const FeatureBanner = () => {
  return (
    <section>
      <div className='px-4 container'>
        <div className=' bg-lightprimary rounded-2xl relative overflow-hidden'>
          <div className='flex w-full'>
            <div className='lg:w-6/12 w-full lg:p-24 py-12 px-4 lg:pe-10 pe-0'>
              <h3 className='text-2xl sm:text-3xl md:text-40 font-bold leading-tight text-link dark:text-white'>
                Develop with feature-rich NextJs Dashboard
              </h3>
              <div className='my-6 flex items-center gap-4'>
                <Button asChild variant={'default'}>
                  <Link href='/auth/auth1/login'>Login</Link>
                </Button>
                <Button asChild variant={'outline'}>
                  <Link href='/auth/auth1/register'>Register</Link>
                </Button>
              </div>
              <p className='text-base font-medium text-link dark:text-white'>
                <span className='font-semibold'>One-time purchase</span> - no
                recurring fees.
              </p>
            </div>
          </div>
          <Image
            src='/images/frontend-pages/background/design-collection.png'
            alt='banner'
            width={800}
            height={600}
            className='absolute top-0 -end-[300px] rtl:-scale-x-100 lg:block hidden'
          />
        </div>
      </div>
    </section>
  )
}
