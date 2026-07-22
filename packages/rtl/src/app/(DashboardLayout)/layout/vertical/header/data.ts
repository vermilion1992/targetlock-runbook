//Apps Links Type & Data
interface appsLinkType {
  href: string
  title: string
  subtext: string
  avatar: string
}

const appsLink: appsLinkType[] = [
  {
    href: '/apps/chats',
    title: 'Chat Application',
    subtext: 'New messages arrived',
    avatar: '/images/svgs/icon-dd-chat.svg',
  },
  {
    href: '/apps/ecommerce/shop',
    title: 'eCommerce App',
    subtext: 'New stock available',
    avatar: '/images/svgs/icon-dd-cart.svg',
  },
  {
    href: '/apps/notes',
    title: 'Notes App',
    subtext: 'To-do and Daily tasks',
    avatar: '/images/svgs/icon-dd-invoice.svg',
  },
  {
    href: '/apps/calendar',
    title: 'Calendar App',
    subtext: 'Get dates',
    avatar: '/images/svgs/icon-dd-date.svg',
  },
  {
    href: '/apps/contacts',
    title: 'Contact Application',
    subtext: '2 Unsaved Contacts',
    avatar: '/images/svgs/icon-dd-mobile.svg',
  },
  {
    href: '/apps/tickets',
    title: 'Tickets App',
    subtext: 'Submit tickets',
    avatar: '/images/svgs/icon-dd-lifebuoy.svg',
  },
  {
    href: '/apps/email',
    title: 'Email App',
    subtext: 'Get new emails',
    avatar: '/images/svgs/icon-dd-message-box.svg',
  },
  {
    href: '/apps/blog/post',
    title: 'Blog App',
    subtext: 'added new blog',
    avatar: '/images/svgs/icon-dd-application.svg',
  },
]

interface LinkType {
  href: string
  title: string
}

const pageLinks: LinkType[] = [
  {
    href: '/theme-pages/pricing',
    title: 'Pricing Page',
  },
  {
    href: '/auth/auth1/login',
    title: 'Authentication Design',
  },
  {
    href: '/auth/auth1/register',
    title: 'Register Now',
  },
  {
    href: '/404',
    title: '404 Error Page',
  },
  {
    href: '/apps/kanban',
    title: 'Kanban App',
  },
  {
    href: '/apps/user-profile/profile',
    title: 'User Application',
  },
  {
    href: '/apps/blog/post',
    title: 'Blog Design',
  },
  {
    href: '/apps/ecommerce/checkout',
    title: 'Shopping Cart',
  },
]

//   Search Data
interface SearchType {
  href: string
  title: string
}

const SearchLinks: SearchType[] = [
  {
    title: 'Modern',
    href: '/',
  },
  {
    title: 'eCommerce',
    href: '/dashboards/eCommerce',
  },
  {
    title: 'General',
    href: '/dashboards/general',
  },
  {
    title: 'Music',
    href: '/dashboards/music',
  },
  {
    title: 'General',
    href: '/dashboards/general',
  },
]

//   Message Data
interface MessageType {
  title: string
  avatar: string
  subtitle: string
}

const MessagesLink: MessageType[] = [
  {
    avatar: '/images/profile/user-2.jpg',
    title: 'Roman Joined the Team!',
    subtitle: 'Congratulate him',
  },
  {
    avatar: '/images/profile/user-3.jpg',
    title: 'New message',
    subtitle: 'Salma sent you new message',
  },
  {
    avatar: '/images/profile/user-4.jpg',
    title: 'Bianca sent payment',
    subtitle: 'Check your earnings',
  },
  {
    avatar: '/images/profile/user-5.jpg',
    title: 'Jolly completed tasks',
    subtitle: 'Assign her new tasks',
  },
  {
    avatar: '/images/profile/user-6.jpg',
    title: 'John received payment',
    subtitle: '$230 deducted from account',
  },
]

//   Notification Data
interface NotificationType {
  title: string
  icon: string
  subtitle: string
  bgcolor: string
  color: string
  time: string
}

const Notification: NotificationType[] = [
  {
    icon: 'solar:widget-3-line-duotone',
    bgcolor: 'bg-lighterror dark:bg-lighterror',
    color: 'text-error',
    title: 'Launch Admin',
    subtitle: 'Just see the my new admin!',
    time: '9:30 AM',
  },
  {
    icon: 'solar:calendar-line-duotone',
    bgcolor: 'bg-lightprimary dark:bg-lightprimary',
    color: 'text-primary',
    title: 'Event Today',
    subtitle: 'Just a reminder that you have event',
    time: '9:15 AM',
  },
  {
    icon: 'solar:settings-line-duotone',
    bgcolor: 'bg-lightsecondary dark:bg-lightsecondary',
    color: 'text-secondary',
    title: 'Settings',
    subtitle: 'You can customize this template as you want',
    time: '4:36 PM',
  },
  {
    icon: 'solar:widget-4-line-duotone',
    bgcolor: 'bg-lightwarning dark:bg-lightwarning ',
    color: 'text-warning',
    title: 'Launch Admin',
    subtitle: 'Just see the my new admin!',
    time: '9:30 AM',
  },
  {
    icon: 'solar:calendar-line-duotone',
    bgcolor: 'bg-lightprimary dark:bg-lightprimary',
    color: 'text-primary',
    title: 'Event Today',
    subtitle: 'Just a reminder that you have event',
    time: '9:15 AM',
  },
  {
    icon: 'solar:settings-line-duotone',
    bgcolor: 'bg-lightsecondary dark:bg-lightsecondary',
    color: 'text-secondary',
    title: 'Settings',
    subtitle: 'You can customize this template as you want',
    time: '4:36 PM',
  },
]

//  Profile Data
interface ProfileType {
  title: string
  img: string
  subtitle: string
  url: string
}

const profileDD: ProfileType[] = [
  {
    img: '/images/svgs/icon-account.svg',
    title: 'My Profile',
    subtitle: 'Account settings',
    url: '/apps/user-profile/profile',
  },
  {
    img: '/images/svgs/icon-inbox.svg',
    title: 'My Notes',
    subtitle: 'My Daily Notes',
    url: '/apps/notes',
  },
  {
    img: '/images/svgs/icon-tasks.svg',
    title: 'My Tasks',
    subtitle: 'To-do and Daily tasks',
    url: '/apps/kanban',
  },
]

export {
  appsLink,
  pageLinks,
  SearchLinks,
  MessagesLink,
  Notification,
  profileDD,
}
