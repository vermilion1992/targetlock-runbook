import { Metadata } from 'next'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import AnimatedDropzone from '@/app/components/form-components/form-dropzone/AnimatedDropzone'
import DefaultDropzone from '@/app/components/form-components/form-dropzone/DefaultDropzone'

export const metadata: Metadata = {
  title: 'Form Dropzone',
}

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Dropzone',
  },
]

const page = () => {
  return (
    <>
      <BreadcrumbComp title='Dropzone' items={BCrumb} />
      <div className='flex flex-col gap-6'>
        <div>
          <DefaultDropzone />
        </div>
        <div>
          <AnimatedDropzone />
        </div>
      </div>
    </>
  )
}

export default page
