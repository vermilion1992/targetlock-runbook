'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

const AuthLogin = () => {
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const form = e.currentTarget
    const username = form.username.value.trim()
    const password = form.password.value.trim()

    if (!username || !password) {
      alert('Please fill in all fields')
      return
    }

    // Success - redirect or call API
    router.push('/')
  }

  return (
    <form onSubmit={handleSubmit} className='mt-6'>
      <div className='mb-4'>
        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          name='username'
          type='text'
          required
          placeholder='Enter your username'
        />
      </div>
      <div className='mb-4'>
        <Label htmlFor='password'>Password</Label>
        <Input
          id='password'
          name='password'
          type='password'
          required
          placeholder='Enter your password'
        />
      </div>
      <div className='flex justify-between my-5'>
        <div className='flex items-center gap-2'>
          <Checkbox id='remember' />
          <Label htmlFor='remember' className='mb-0'>Remember this Device</Label>
        </div>
        <Link
          href='/auth/auth1/forgot-password'
          className='text-primary text-sm font-medium'>
          Forgot Password?
        </Link>
      </div>
      <Button type='submit' className='w-full'>
        Sign in
      </Button>
    </form>
  )
}

export default AuthLogin
