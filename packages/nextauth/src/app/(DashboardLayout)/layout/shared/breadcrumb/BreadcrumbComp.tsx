import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface BreadcrumbItem {
  title: string;
  to?: string;
}

interface BreadCrumbType {
  subtitle?: string;
  items?: BreadcrumbItem[];
  title: string;
}

const BreadcrumbComp = ({ title }: BreadCrumbType) => {
  return (
    <>
      <Card
        className={`mb-6 py-4 bg-lightsecondary dark:bg-lightsecondary overflow-hidden rounded-md border-none !shadow-none dark:!shadow-none`}
      >
        <div className="flex items-center justify-between gap-6 relative">
          <div>
            <h4 className="font-semibold text-xl text-dark dark:text-white mb-3">
              {title}
            </h4>
            <ol
              className="flex items-center whitespace-nowrap"
              aria-label="Breadcrumb"
            >
              <li className="flex items-center">
                <Link
                  className="opacity-80 text-sm text-link dark:text-darklink leading-none"
                  href="/"
                >
                  Home
                </Link>
              </li>
              <li>
                <div className="p-0.5 rounded-full bg-link dark:bg-darklink mx-2.5 flex items-center"></div>
              </li>
              <li
                className="flex items-center text-sm text-link dark:text-darklink leading-none"
                aria-current="page"
              >
                {title}
              </li>
            </ol>
          </div>
          <div className="absolute -top-6.5 right-0 max-h-[95px] max-w-[145px]  hidden sm:block breadcrumbImage">
            <Image
              src={"/images/breadcrumb/customer-support-img.png"}
              alt="customer-support-img"
              width={145}
              height={95}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </Card>
    </>
  );
};

export default BreadcrumbComp;
