import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp'
import TitleCard from '@/app/components/shared/TitleBorderCard'
import CheckboxTable from '@/app/components/shadcn-table/checkbox/CheckboxTable'

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Checkbox Table',
  },
]

function page() {
  return (
    <>
      <BreadcrumbComp title='Shadcn Checkbox Table' items={BCrumb} />
      <TitleCard title='Checkbox Table'>
        <div className='grid grid-cols-12 gap-7'>
          <div className='col-span-12'>
            <CheckboxTable />
          </div>
        </div>
      </TitleCard>
    </>
  )
}

export default page
