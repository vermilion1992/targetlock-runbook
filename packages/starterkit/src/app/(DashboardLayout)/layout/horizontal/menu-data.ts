import { uniqueId } from 'lodash';

export interface MenuItem {
  id: string;
  title: string;
  icon?: string;
  href?: string;
  column?: number;

  // optional states
  disabled?: boolean;
  subtitle?: string;

  // badge support
  badge?: boolean;
  badgeType?: "filled" | "outlined";

  // recursive children
  children?: MenuItem[];
}

const Menuitems: MenuItem[] = [
  {
    id: uniqueId(),
    title: 'Dashboard',
    icon: 'solar:layers-line-duotone',
    href: '',
    column: 1,
    children: [
      {
        id: uniqueId(),
        title: 'Sample Page 1',
        icon: 'solar:home-angle-outline',
        href: '/',
      },
    ],
  },
];
export default Menuitems;
