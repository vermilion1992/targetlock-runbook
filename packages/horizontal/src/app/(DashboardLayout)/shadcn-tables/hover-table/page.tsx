import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import TitleCard from '@/app/components/shared/TitleBorderCard'
import HoverTable from '@/app/components/shadcn-table/hover/HoverTable';


const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Hover Table',
  },
];

function page() {
  return (
    <>
      <BreadcrumbComp title="Shadcn Hover Table" items={BCrumb} />
      <TitleCard title="Hover Table">
        <div className="grid grid-cols-12 gap-7">
          <div className="col-span-12">
            <HoverTable />
          </div>
        </div>
      </TitleCard>
    </>
  );
}

export default page;
