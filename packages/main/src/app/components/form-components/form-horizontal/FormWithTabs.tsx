'use client'
import React from 'react'
import { useState } from 'react'
import TitleCard from '../../shared/TitleBorderCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const FormWithTabs = () => {
  const [date, setDate] = useState<Date | undefined>()
  return (
    <div>
      <TitleCard title='Form With Tabs'>
        <div className='overflow-x-auto'>
          <Tabs defaultValue='personal' className='gap-6'>
            <TabsList className='mb-6'>
              <TabsTrigger value='personal'>Personal Info</TabsTrigger>
              <TabsTrigger value='account'>Account Details</TabsTrigger>
              <TabsTrigger value='social'>Social Links</TabsTrigger>
            </TabsList>

            {/* Personal Info Tab */}
            <TabsContent value='personal'>
              <div className='grid grid-cols-12 gap-7'>
                <div className='lg:col-span-6 col-span-12 flex flex-col gap-7'>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='firstname' className='col-span-3'>
                      First Name
                    </Label>
                    <Input
                      id='firstname'
                      type='text'
                      placeholder='John'
                      className='col-span-9'
                    />
                  </div>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='country' className='col-span-3'>
                      Country
                    </Label>
                    <Select defaultValue='India' required>
                      <SelectTrigger className='col-span-9'>
                        <SelectValue placeholder='Select a country' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='India'>India</SelectItem>
                        <SelectItem value='Europe'>Europe</SelectItem>
                        <SelectItem value='French'>French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='birthdate' className='col-span-3'>
                      Birth Date
                    </Label>
                    <div className='col-span-9'>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            className={cn(
                              'w-full justify-start text-left font-normal border-ld hover:border-primary hover:bg-transparent text-ld hover:text-ld',
                              !date &&
                                'text-muted-foreground hover:text-muted-foreground'
                            )}>
                            <CalendarIcon className='mr-2 h-4 w-4' />
                            {date ? (
                              format(date, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto p-0' align='start'>
                          <Calendar
                            mode='single'
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className='lg:col-span-6 col-span-12 flex flex-col gap-7'>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='lastname' className='col-span-3'>
                      Last Name
                    </Label>
                    <Input
                      id='lastname'
                      type='text'
                      placeholder='Deo'
                      className='col-span-9'
                    />
                  </div>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='language' className='col-span-3'>
                      Language
                    </Label>
                    <Select defaultValue='English' required>
                      <SelectTrigger className='col-span-9'>
                        <SelectValue placeholder='Select a language' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='English'>English</SelectItem>
                        <SelectItem value='French'>French</SelectItem>
                        <SelectItem value='Spanish'>Spanish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='phone' className='col-span-3'>
                      Phone No
                    </Label>
                    <Input
                      id='phone'
                      type='text'
                      placeholder='958 1475 458'
                      className='col-span-9'
                    />
                  </div>
                </div>
              </div>

              <div className='flex justify-center gap-5 mt-7'>
                <Button type='submit' variant='default'>
                  Submit
                </Button>
                <Button type='reset' variant='destructive'>
                  Cancel
                </Button>
              </div>
            </TabsContent>

            {/* Account Details Tab */}
            <TabsContent value='account'>
              <div className='grid grid-cols-12 gap-7'>
                <div className='lg:col-span-6 col-span-12 flex flex-col gap-7'>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='username' className='col-span-3'>
                      Username
                    </Label>
                    <Input
                      id='username'
                      type='text'
                      placeholder='John.Deo'
                      className='col-span-9'
                    />
                  </div>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='password' className='col-span-3'>
                      Password
                    </Label>
                    <Input
                      id='password'
                      type='password'
                      placeholder='********'
                      className='col-span-9'
                    />
                  </div>
                </div>

                <div className='lg:col-span-6 col-span-12 flex flex-col gap-7'>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='email' className='col-span-3'>
                      Email
                    </Label>
                    <Input
                      id='email'
                      type='email'
                      placeholder='john.deo@example.com'
                      className='col-span-9'
                    />
                  </div>
                  <div className='grid grid-cols-12 items-center gap-7'>
                    <Label htmlFor='confirm' className='col-span-3'>
                      Confirm
                    </Label>
                    <Input
                      id='confirm'
                      type='password'
                      placeholder='********'
                      className='col-span-9'
                    />
                  </div>
                </div>
              </div>

              <div className='flex justify-center gap-5 mt-7'>
                <Button type='submit' variant='default'>
                  Submit
                </Button>
                <Button type='reset' variant='destructive'>
                  Cancel
                </Button>
              </div>
            </TabsContent>

            {/* Social Links Tab */}
            <TabsContent value='social'>
              <div className='grid grid-cols-12 gap-7'>
                <div className='lg:col-span-6 col-span-12 flex flex-col gap-7'>
                  {[
                    {
                      id: 'twitter',
                      label: 'Twitter',
                      placeholder: 'https://twitter.com/abc',
                    },
                    {
                      id: 'google',
                      label: 'Google',
                      placeholder: 'https://plus.google.com/abc',
                    },
                    {
                      id: 'instagram',
                      label: 'Instagram',
                      placeholder: 'https://instagram.com/abc',
                    },
                  ].map(({ id, label, placeholder }) => (
                    <div
                      key={id}
                      className='grid grid-cols-12 items-center gap-7'>
                      <Label htmlFor={id} className='col-span-3'>
                        {label}
                      </Label>
                      <Input
                        id={id}
                        type='text'
                        placeholder={placeholder}
                        className='col-span-9'
                      />
                    </div>
                  ))}
                </div>

                <div className='lg:col-span-6 col-span-12 flex flex-col gap-7'>
                  {[
                    {
                      id: 'facebook',
                      label: 'Facebook',
                      placeholder: 'https://facebook.com/abc',
                    },
                    {
                      id: 'linkedin',
                      label: 'Linkedin',
                      placeholder: 'https://linkedin.com/abc',
                    },
                    {
                      id: 'quora',
                      label: 'Quora',
                      placeholder: 'https://quora.com/abc',
                    },
                  ].map(({ id, label, placeholder }) => (
                    <div
                      key={id}
                      className='grid grid-cols-12 items-center gap-7'>
                      <Label htmlFor={id} className='col-span-3'>
                        {label}
                      </Label>
                      <Input
                        id={id}
                        type='text'
                        placeholder={placeholder}
                        className='col-span-9'
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className='flex justify-center gap-5 mt-7'>
                <Button type='submit' variant='default'>
                  Submit
                </Button>
                <Button type='reset' variant='destructive'>
                  Cancel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </TitleCard>
    </div>
  )
}

export default FormWithTabs
