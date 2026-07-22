import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import { DefaultAutocomplete } from '@/app/components/form-components/form-autocomplete/DefaultAutocomplete'
import CommandAutocomplete from '@/app/components/form-components/form-autocomplete/CommandAutocomplete'

export const metadata: Metadata = {
  title: 'Form Autocomplete',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Autocomplete',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Autocomplete' items={BCrumb} />
      <div className='flex flex-col gap-6'>
        <div>
          <DefaultAutocomplete />
        </div>
        <div>
            <CommandAutocomplete />
        </div>
      </div>
    </>
  )
}

export default page
