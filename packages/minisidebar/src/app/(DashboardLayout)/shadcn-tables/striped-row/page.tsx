import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import TitleCard from '@/app/components/shared/TitleBorderCard'
import StripedRowTable from '@/app/components/shadcn-table/striped-row/StripedRowTable';


const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Striped Raw',
  },
];

function page() {
  return (
    <>
      <BreadcrumbComp title="Shadcn Striped Table" items={BCrumb} />
      <TitleCard title="Striped Table">
        <div className="grid grid-cols-12 gap-7">
          <div className="col-span-12">
            <StripedRowTable />
          </div>
        </div>
      </TitleCard>
    </>
  );
}

export default page;
