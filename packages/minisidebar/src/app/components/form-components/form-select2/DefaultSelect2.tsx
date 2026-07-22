'use client'

import React from 'react'
import Select, { SingleValue, StylesConfig } from 'react-select'
import TitleCard from '@/app/components/shared/TitleBorderCard'
import { Label } from '@/components/ui/label'

interface OptionType {
  value: string;
  label: string;
}

const options: OptionType[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'superadmin', label: 'Super Admin' },
]

const customStyles: StylesConfig<OptionType, false> = {
  control: (base) => ({
    ...base,
    backgroundColor: 'transparent',
    borderColor: 'var(--color-border)',
    minHeight: '38px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--color-primary)',
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    backgroundColor: 'var(--color-background)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--color-primary)' // selected option background
      : state.isFocused
      ? 'var(--color-lightprimary)' // hovered option background
      : 'var(--color-background)', // default background
    color: state.isSelected ? 'white' : 'inherit',
    cursor: 'pointer',
    ':active': {
      backgroundColor: 'var(--color-primary)', // darker shade or same as selected
      color: 'white',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-primary)', // Change this to your desired color
    fontWeight: '600', // Optional: make the text bolder
  }),
}

const DefaultSelect2 = () => {
  const handleChange = (selectedOption: SingleValue<OptionType>) => {
    console.log('Selected:', selectedOption)
  }

  return (
    <TitleCard title='Default Select2'>
      <div className='w-full flex flex-col'>
        <Label>
          User Role
        </Label>
        <Select
          options={options}
          styles={customStyles}
          placeholder='Select role...'
          onChange={handleChange}
        />
      </div>
    </TitleCard>
  )
}

export default DefaultSelect2
