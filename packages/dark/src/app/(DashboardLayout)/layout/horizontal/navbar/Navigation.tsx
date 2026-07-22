'use client'

import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { IconChevronDown } from '@tabler/icons-react'

import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@/components/ui/menubar'

import Menuitems, { MenuItem } from '../menu-data'

const Navigation = () => {
  const pathname = usePathname()
  const { t } = useTranslation()

  /* =======================
   * Helpers
   ======================= */

  const isActive = (href?: string): boolean =>
    typeof href === 'string' && pathname === href

  const isExternal = (href?: string): boolean =>
    typeof href === 'string' && /^https?:\/\//.test(href)

  const hasChildren = (item: MenuItem): boolean =>
    Array.isArray(item.children) && item.children.length > 0

  const isItemActive = (item: MenuItem): boolean =>
    isActive(item.href) ||
    item.children?.some(
      (child) =>
        isActive(child.href) ||
        child.children?.some((grand) => isActive(grand.href))
    ) === true

  /* =======================
   * Render
   ======================= */

  return (
    <div className="py-4 xl:px-0 container mx-auto">
      <Menubar className="horizontal-nav p-0 h-auto min-h-0 border-0 shadow-none flex flex-wrap md:flex-nowrap bg-transparent dark:bg-transparent gap-3 z-50 px-0 rtl:flex-row-reverse rtl:text-end">
        {Menuitems.map((item) => {
          const itemActive = isItemActive(item)

          return (
            <MenubarMenu key={item.id}>
              {/* =======================
               * ITEM WITH CHILDREN
               ======================= */}
              {hasChildren(item) ? (
                <>
                  <MenubarTrigger
                    className={`capitalize font-medium flex gap-2 items-center py-2 px-3 rounded-md cursor-pointer transition-colors
                      ${
                        itemActive
                          ? 'text-white bg-primary'
                          : 'text-link hover:bg-lightprimary hover:text-primary'
                      }`}
                  >
                    {item.icon && (
                      <Icon icon={item.icon} className="w-5 h-5 shrink-0" />
                    )}

                    <span>{t(item.title)}</span>
                    <IconChevronDown size={18} className="ms-auto" />
                  </MenubarTrigger>

                  <MenubarContent className="bg-card dark:bg-dark shadow-lg min-w-[200px] p-2 rounded-md z-[999]">
                    {item.children?.map((child) => {
                      const childActive =
                        isActive(child.href) ||
                        child.children?.some((sub) =>
                          isActive(sub.href)
                        ) === true

                      /* =======================
                       * CHILD WITH SUBCHILDREN
                       ======================= */
                      if (hasChildren(child)) {
                        return (
                          <MenubarSub key={child.id}>
                            <MenubarSubTrigger
                              className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors
                                ${
                                  childActive
                                    ? 'text-primary font-semibold'
                                    : 'text-link'
                                }`}
                            >
                              {child.icon && (
                                <Icon
                                  icon={child.icon}
                                  className="w-5 h-5 shrink-0 transition-colors group-hover:text-primary"
                                />
                              )}

                              <span className="transition-colors group-hover:text-primary">
                                {t(child.title)}
                              </span>
                            </MenubarSubTrigger>

                            <MenubarSubContent className="bg-card dark:bg-dark min-w-[200px] p-2 rounded-md">
                              {child.children?.map((sub) => (
                                <MenubarItem
                                  key={sub.id}
                                  className={`group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors
                                    focus:bg-transparent dark:focus:bg-transparent
                                    ${
                                      isActive(sub.href)
                                        ? 'text-primary font-semibold'
                                        : 'text-ld dark:text-darklink'
                                    }`}
                                >
                                  <Icon
                                    icon="icon-park-outline:dot"
                                    className="text-ld transition-colors group-hover:text-primary"
                                  />

                                  {sub.href && (
                                    <Link
                                      href={sub.href}
                                      target={
                                        isExternal(sub.href)
                                          ? '_blank'
                                          : '_self'
                                      }
                                      className="flex items-center gap-2 w-full"
                                    >
                                      <span className="transition-colors group-hover:text-primary">
                                        {t(sub.title)}
                                      </span>
                                    </Link>
                                  )}
                                </MenubarItem>
                              ))}
                            </MenubarSubContent>
                          </MenubarSub>
                        )
                      }

                      /* =======================
                       * NORMAL CHILD
                       ======================= */
                      return (
                        <MenubarItem
                          key={child.id}
                          className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors
                            focus:bg-transparent dark:focus:bg-transparent
                            ${
                              childActive
                                ? 'text-primary font-semibold'
                                : 'text-ld dark:text-darklink'
                            }`}
                        >
                          {child.icon && (
                            <Icon
                              icon={child.icon}
                              className="w-5 h-5 transition-colors group-hover:text-primary"
                            />
                          )}

                          {child.href && (
                            <Link
                              href={child.href}
                              target={
                                isExternal(child.href)
                                  ? '_blank'
                                  : '_self'
                              }
                              className="flex items-center gap-2 w-full"
                            >
                              <span className="transition-colors group-hover:text-primary">
                                {t(child.title)}
                              </span>
                            </Link>
                          )}
                        </MenubarItem>
                      )
                    })}
                  </MenubarContent>
                </>
              ) : (
                /* =======================
                 * SIMPLE ITEM
                 ======================= */
                <MenubarTrigger asChild>
                  {item.href && (
                    <Link
                      href={item.href}
                      target={isExternal(item.href) ? '_blank' : '_self'}
                      className={`capitalize font-medium flex gap-2 items-center py-2 px-3 rounded-md cursor-pointer transition-colors
                        ${
                          itemActive
                            ? 'text-white bg-primary'
                            : 'text-ld dark:text-darklink hover:bg-lightprimary hover:text-primary'
                        }`}
                    >
                      {item.icon && (
                        <Icon icon={item.icon} className="w-5 h-5 shrink-0" />
                      )}
                      <span>{t(item.title)}</span>
                    </Link>
                  )}
                </MenubarTrigger>
              )}
            </MenubarMenu>
          )
        })}
      </Menubar>
    </div>
  )
}

export default Navigation
