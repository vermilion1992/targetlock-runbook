import React from "react";
import { ChildItem } from "../sidebaritems";
import NavItems from "../nav-Items";
import { Icon } from "@iconify/react";
import { HiOutlineChevronDown } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
interface NavCollapseProps {
  item: ChildItem;
}

const NavCollapse: React.FC<NavCollapseProps> = ({ item }) => {
  const pathname = usePathname();

  const activeDD = item.children?.find((t: ChildItem) => t.url === pathname);

  const { t } = useTranslation();

  const [open, setOpen] = React.useState(!!activeDD);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={twMerge(
              "flex w-full items-center justify-between gap-3 rounded-md p-3 text-start truncate cursor-pointer !leading-normal text-link dark:text-darklink font-normal collapse-menu transition-all duration-200 ease-in-out hover:translate-x-1",
              "hover:bg-lightprimary dark:hover:bg-darkprimary",
              "hover:text-primary dark:hover:text-primary",
              open &&
                "text-white dark:text-white bg-primary dark:bg-primary hover:bg-primary dark:hover:bg-primary hover:!text-white",
              activeDD &&
                "text-white dark:text-white bg-primary dark:bg-primary hover:bg-primary dark:hover:bg-primary hover:!text-white"
            )}
          >
            <div className="flex items-center gap-3">
              {item.icon && (
                <Icon
                  icon={item.icon}
                  height={21}
                  width={21}
                  className="transition-colors duration-200"
                />
              )}
              <span className="max-w-29 overflow-hidden truncate leading-tight">
                {t(item.name || "")}
              </span>
            </div>

            <HiOutlineChevronDown
              aria-hidden
              className={twMerge(
                "transition-transform duration-200",
                open ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex flex-col pb-2 pl-1">
          {item.children?.map((child) => (
            <React.Fragment key={child.id}>
              {child.children ? (
                <NavCollapse item={child} />
              ) : (
                <NavItems item={child} isInsideCollapse />
              )}
            </React.Fragment>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
};

export default NavCollapse;
