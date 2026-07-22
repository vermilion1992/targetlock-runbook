'use client'

import TitleCard from '@/app/components/shared/TitleBorderCard'
import { Icon } from '@iconify/react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const DefaultDropzone = () => {
  return (
    <>
      <TitleCard title='Default Dropzone'>
        <div className='flex w-full items-center justify-center'>
          <Label
            htmlFor='dropzone-file'
            className='flex  w-full cursor-pointer flex-col items-center justify-center rounded-md border-[1px] border-dashed border-primary bg-lightprimary'>
            <div className='flex flex-col items-center justify-center pb-6 pt-5'>
              <Icon
                icon='solar:cloud-upload-outline'
                height={32}
                className='mb-3 text-darklink'
              />
              <p className='mb-2 text-sm text-darklink'>
                Drop Thumbnail here to upload
              </p>
            </div>
            <Input type='file' id='dropzone-file' className='hidden' />
          </Label>
        </div>
      </TitleCard>
    </>
  )
}

export default DefaultDropzone
