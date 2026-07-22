'use client'
import CardBox from '../../shared/CardBox'
import OrderDataTable from './OrderDataTable'

function OrderTable() {
  const orders = [
    {
      id: 'ORD-001',
      avatar: '/images/profile/user-1.jpg',
      customerName: 'John Doe',
      status: 'Pending',
      badgecolor: 'lightwarning',
      date: '06-10-2025',
      time: '10:31AM',
      amount: 80.5,
      address: '123 Main St, New York, NY',
      items: [
        {
          image: '/images/products/boat-headphone.jpg',
          name: 'Headphone',
          sku: 'TS-001',
          quantity: 2,
          price: 20,
        },
        {
          image: '/images/products/new-book.jpg',
          name: 'Books',
          sku: 'MG-009',
          quantity: 1,
          price: 10.5,
        },
      ],
    },
    {
      id: 'ORD-002',
      avatar: '/images/profile/user-2.jpg',
      customerName: 'Jane Smith',
      status: 'Completed',
      badgecolor: 'lightsuccess',
      date: '06-09-2025',
      time: '11:31AM',
      amount: 814.0,
      address: '456 Elm St, Los Angeles, CA',
      items: [
        {
          image: '/images/products/advance-macbook.jpg',
          name: 'Macbook pro',
          sku: 'ES-021',
          quantity: 1,
          price: 799.0,
        },
      ],
    },
    {
      id: 'ORD-003',
      avatar: '/images/profile/user-3.jpg',
      customerName: 'Bob Johnson',
      status: 'Shipped',
      badgecolor: 'lightprimary',
      date: '06-08-2025',
      time: '12:01AM',
      amount: 407.3,
      address: '789 Pine St, Chicago, IL',
      items: [
        {
          image: '/images/products/s11.jpg',
          name: 'Teddy',
          sku: 'TS-024',
          quantity: 2,
          price: 99.4,
        },
        {
          image: '/images/products/little-angel-toy.jpg',
          name: 'Tiny Dino',
          sku: 'TS-024',
          quantity: 2,
          price: 89.25,
        },
      ],
    },
    {
      id: 'ORD-004',
      avatar: '/images/profile/user-4.jpg',
      customerName: 'Georgeanna Ramero',
      status: 'Cancelled',
      badgecolor: 'lighterror',
      date: '06-08-2025',
      time: '01:06AM',
      amount: 1127.1,
      address: '19214 110th Rd, Saint Albans, NY, 1141',
      items: [
        {
          image: '/images/products/shoes.jpg',
          name: 'Red hills',
          sku: 'FS-027',
          quantity: 1,
          price: 497.8,
        },
        {
          image: '/images/products/s7.jpg',
          name: 'Red Dress',
          sku: 'FS-029',
          quantity: 1,
          price: 599.3,
        },
      ],
    },
    {
      id: 'ORD-005',
      avatar: '/images/profile/user-5.jpg',
      customerName: 'Dalton Paden',
      status: 'Processing',
      badgecolor: 'lightinfo',
      date: '06-06-2025',
      time: '02:34AM',
      amount: 311.0,
      address: '19103 Stefani Ave, Cerritos, CA, 90703',
      items: [
        {
          image: '/images/products/new-games.jpg',
          name: 'X-box console',
          sku: 'ES-018',
          quantity: 1,
          price: 296.0,
        },
      ],
    },
    {
      id: 'ORD-006',
      avatar: '/images/profile/user-6.jpg',
      customerName: 'Cami Macha',
      status: 'Pending',
      badgecolor: 'lightwarning',
      date: '09-06-2025',
      time: '02:34AM',
      amount: 213.0,
      address: '930 Fruit Ave, Farrell, PA, 16121',
      items: [
        {
          image: '/images/products/little-angel-toy.jpg',
          name: 'Soft Toys',
          sku: 'TS-016',
          quantity: 2,
          price: 99.0,
        },
      ],
    },
  ]

  return (
    <CardBox>
      <OrderDataTable data={orders} />
    </CardBox>
  )
}

export default OrderTable
