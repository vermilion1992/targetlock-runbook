import Image from 'next/image'

export const PaymentOptions = () => {
  const paymentOptions = [
    {
      key: 'option1',
      img: '/images/frontend-pages/payments/visa.svg',
    },
    {
      key: 'option2',
      img: '/images/frontend-pages/payments/master.svg',
    },
    {
      key: 'option3',
      img: '/images/frontend-pages/payments/american-exp.svg',
    },
    {
      key: 'option4',
      img: '/images/frontend-pages/payments/discover.svg',
    },
    {
      key: 'option5',
      img: '/images/frontend-pages/payments/paypal.svg',
    },
    {
      key: 'option6',
      img: '/images/frontend-pages/payments/maesro.svg',
    },
    {
      key: 'option7',
      img: '/images/frontend-pages/payments/jcb.svg',
    },
    {
      key: 'option8',
      img: '/images/frontend-pages/payments/dinners-clb.svg',
    },
  ]
  return (
    <section>
      <div className='px-4 pt-12'>
        <p className='text-base font-medium text-lightmuted dark:text-darklink text-center mb-8'>
          Secured payment with PayPal & Razorpay
        </p>
        <div className='flex items-center flex-wrap justify-center gap-6 sm:gap-12'>
          {paymentOptions.map((item) => {
            return (
              <Image
                key={item.key}
                src={item.img}
                alt='payment'
                width={64}
                height={40}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
