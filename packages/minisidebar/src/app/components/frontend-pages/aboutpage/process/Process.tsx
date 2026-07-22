import Image from 'next/image'

export const Process = () => {
  const ProcessInfo = [
    {
      key: 'process1',
      title: 'Light & Dark Color Schemes',
      desc: 'Choose your preferred visual style effortlessly.',
      bgcolor: 'bg-lightwarning dark:bg-lightwarning',
      img: '/images/svgs/icon-briefcase.svg',
      isBg: false,
    },
    {
      key: 'process2',
      title: '12+ Ready to Use Application Designs',
      desc: 'Instantly deployable designs for your applications.',
      bgcolor: 'bg-lightsecondary dark:bg-lightsecondary',
      img: '/images/frontend-pages/background/app-widget.png',
      isBg: true,
    },
    {
      key: 'process3',
      title: 'Code Improvements',
      desc: 'Benefit from improvements and optimizations.',
      bgcolor: 'bg-lightsuccess dark:bg-lightsuccess',
      img: '/images/svgs/icon-speech-bubble.svg',
      isBg: false,
    },
    {
      key: 'process4',
      title: '50+ UI Components',
      desc: 'A rich collection for seamless user experiences.',
      bgcolor: 'bg-lighterror dark:bg-lighterror',
      img: '/images/svgs/icon-favorites.svg',
      isBg: false,
    },
  ]
  return (
    <>
      <div className='container-md px-4 lg:py-24 py-12'>
        <h2 className='lg:text-40 text-3xl font-bold text-link dark:text-white text-center mb-12 leading-tight'>
          The hassle-free setup process
        </h2>
        <div className='grid grid-cols-12 gap-6'>
          {ProcessInfo.map((item) => {
            if (!item.isBg) {
              return (
                <div
                  key={item.key}
                  className='lg:col-span-3 md:col-span-6 col-span-12'>
                  <div
                    className={`py-12 px-4 justify-center rounded-2xl ${item.bgcolor}`}>
                    <Image
                      src={item.img}
                      alt='image'
                      width={48}
                      height={48}
                      className='mx-auto'
                    />
                    <h3 className='py-4 text-center font-bold text-link dark:text-white text-lg'>
                      {item.title}
                    </h3>
                    <p className='text-lightmuted dark:text-darklink text-base font-normal text-center'>
                      {item.desc}
                    </p>
                  </div>
                </div>
              )
            } else {
              return (
                <div
                  key={item.key}
                  className='lg:col-span-3 md:col-span-6 col-span-12'>
                  <div
                    className={`pt-12 px-4 justify-center rounded-2xl ${item.bgcolor}`}>
                    <h3 className='pb-4 text-center font-bold text-link dark:text-white text-lg px-3'>
                      {item.title}
                    </h3>
                    <p className='text-lightmuted mb-6 dark:text-darklink text-base font-normal text-center'>
                      {item.desc}
                    </p>
                    <Image
                      src={item.img}
                      alt='image'
                      width={240}
                      height={160}
                      className='mx-auto px-6'
                    />
                  </div>
                </div>
              )
            }
          })}
        </div>
      </div>
    </>
  )
}
