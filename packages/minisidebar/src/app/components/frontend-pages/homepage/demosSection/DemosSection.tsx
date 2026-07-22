import Image from 'next/image'

export const DemosSection = () => {
  return (
    <section>
      <div className='container-md lg:py-24 py-12 px-4'>
        <div className='flex justify-center w-full mb-12'>
          <div className='lg:w-6/12 w-full'>
            <p className='text-base text-lightmuted dark:text-darklink text-center'>
              Introducing TailwindAdmin's Light & Dark Skins,{' '}
              <span className='font-semibold text-lightmuted dark:text-darklink'>
                Exceptional Dashboards
              </span>
              , and Dynamic Pages - Stay Updated on What's New!
            </p>
          </div>
        </div>
        <div className='flex w-full lg:flex-nowrap flex-wrap gap-6'>
          <div className='lg:w-[28%] w-full'>
            <div className=' py-12 px-6 justify-center rounded-2xl bg-lightwarning dark:bg-lightwarning mb-6'>
              <Image
                src='/images/svgs/icon-briefcase.svg'
                alt='image'
                width={48}
                height={48}
                className='mx-auto'
              />
              <h2 className='py-4 text-center font-bold text-link dark:text-white text-lg'>
                Light & Dark Color Schemes
              </h2>
              <p className='text-lightmuted dark:text-darklink text-base font-normal text-center'>
                Choose your preferred visual style effortlessly.
              </p>
            </div>
            <div className=' pt-12 px-6 justify-center rounded-2xl bg-lightsuccess dark:bg-lightsuccess'>
              <h2 className='pb-4 text-center font-bold text-link dark:text-white text-lg px-3'>
                12+ Ready to Use Application Designs
              </h2>
              <p className='text-lightmuted mb-5 dark:text-darklink text-base font-normal text-center'>
                Instantly deployable designs for your applications.
              </p>
              <Image
                src='/images/frontend-pages/background/app-widget.png'
                alt='image'
                width={240}
                height={160}
                className='mx-auto px-6'
              />
            </div>
          </div>
          <div className='lg:w-5/12 w-full'>
            <div className=' py-12 px-6 justify-center rounded-2xl bg-lightprimary dark:bg-lightprimary'>
              <Image
                src='/favicon.svg'
                alt='image'
                width={52}
                height={52}
                className='mx-auto'
              />
              <h2 className='py-4 font-bold text-link dark:text-white text-center text-2xl sm:text-3xl md:text-40 leading-normal'>
                New Demos
              </h2>
              <p className='text-lightmuted dark:text-darklink text-base font-normal text-center pb-6'>
                Brand new demos to help you build the perfect dashboard:{' '}
                <span className='font-semibold'>Dark</span> and{' '}
                <span className='font-semibold'>Right-to-Left</span>.
              </p>
              <Image
                src='/images/frontend-pages/background/Scene.png'
                alt='image'
                width={600}
                height={400}
                className='xl:mt-4 lg:mt-20 mt-4 lg:px-6 px-0'
              />
            </div>
          </div>
          <div className='lg:w-[28%] w-full'>
            <div className=' py-12 px-6 justify-center rounded-2xl bg-lightsuccess dark:bg-lightsuccess mb-6'>
              <Image
                src='/images/svgs/icon-speech-bubble.svg'
                alt='image'
                width={48}
                height={48}
                className='mx-auto'
              />
              <h2 className='py-4 text-center font-bold text-link dark:text-white text-lg'>
                Code Improvements
              </h2>
              <p className='text-lightmuted dark:text-darklink text-base font-normal text-center'>
                Benefit from continuous improvements and optimizations.
              </p>
            </div>
            <div className=' py-12 px-6 justify-center rounded-2xl bg-lighterror dark:bg-lighterror'>
              <Image
                src='/images/svgs/icon-favorites.svg'
                alt='image'
                width={48}
                height={48}
                className='mx-auto'
              />
              <h2 className='py-4 text-center font-bold text-link dark:text-white text-lg'>
                50+ UI Components
              </h2>
              <p className='text-lightmuted dark:text-darklink text-base font-normal text-center'>
                A rich collection for seamless user experiences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
