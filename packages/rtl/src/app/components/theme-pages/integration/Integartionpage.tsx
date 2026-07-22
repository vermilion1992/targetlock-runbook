'use client'
import { Icon } from '@iconify/react/dist/iconify.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useState } from 'react'
import SettingsModal from './SettingsModal'
import DetailModal from './DetailModal'
import NewIntegrationModal from './NewIntegrationModal'
import RemoveModal from './RemoveModal'
import Image from 'next/image'

type Integration = {
  name: string
  desc: string
  icon: string
  icondark?: string
  enabled: boolean
}

export const integrations = [
  {
    name: 'Gmail',
    desc: 'Integrate Gmail to send, receive, and manage emails directly from your workspace.',
    icon: '/images/inetegrationpage/Gmail.svg',
    enabled: false,
  },
  {
    name: 'Google Meet',
    desc: 'Connect your Google Meet account for seamless video conferencing.',
    icon: '/images/inetegrationpage/Google Meet.svg',
    enabled: false,
  },
  {
    name: 'Linear',
    desc: 'Integrate Linear to manage issues, track progress, and streamline your team’s.',
    icon: '/images/inetegrationpage/Linear.svg',
    enabled: false,
  },
  {
    name: 'Loom',
    desc: 'Integrate Loom to easily record, share, and manage video messages.',
    icon: '/images/inetegrationpage/Loom.svg',
    enabled: false,
  },
  {
    name: 'Zoom',
    desc: 'Integrate Zoom to streamline your virtual meetings and team collaborations.',
    icon: '/images/inetegrationpage/Zoom.svg',
    enabled: true,
  },
  {
    name: 'Mailchimp',
    desc: 'Connect Mailchimp to streamline your email marketing—automate campaigns.',
    icon: '/images/inetegrationpage/Mailchimp.svg',
    icondark: '/images/inetegrationpage/Mailchimpdark.svg',
    enabled: true,
  },
  {
    name: 'Notion',
    desc: 'Capture, organize, and tackle your to-dos from anywhere.',
    icon: '/images/inetegrationpage/Notion.svg',
    enabled: false,
  },
  {
    name: 'Trello',
    desc: 'Capture, organize, and tackle your to-dos from anywhere.',
    icon: '/images/inetegrationpage/Trello.svg',
    enabled: false,
  },
  {
    name: 'Jira',
    desc: 'Track issues and manage projects with ease and full team visibility.',
    icon: '/images/inetegrationpage/Jira.svg',
    enabled: false,
  },
]

function Integartionpage() {
  const [integrationStates, setIntegrationStates] = useState(integrations)
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showNewIntegrationModal, setShowNewIntegrationModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [_, setSelectedIntegration] = useState<Integration | null>(null)

  return (
    <Card>
      <div className='flex flex-col gap-5 sm:flex-row sm:items-center justify-between mb-5 '>
        <div>
          <h3 className='card-title'>Integrations</h3>
        </div>
        <div>
          <Button
            className=' flex items-center gap-2 '
            onClick={() => setShowNewIntegrationModal(true)}>
            <Icon icon='solar:add-circle-line-duotone' width={20} height={20} />
            Add New Integration
          </Button>
        </div>
      </div>
      <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
        {integrationStates.map((integration, idx) => (
          <Card key={idx} className='p-0'>
            <div className='p-5 pb-9'>
              <div className='flex items-start justify-between gap-3'>
                <div className='mb-5 inline-flex items-center justify-center'>
                  <Image
                    src={integration.icon}
                    alt={`${integration.name} logo`}
                    className={`h-10 w-10 object-contain ${
                      integration.icondark ? 'block dark:hidden' : ''
                    }`}
                    width={40}
                    height={40}
                  />

                  {/* Dark mode: show icondark if it exists */}
                  {integration.icondark && (
                    <Image
                      src={integration.icondark}
                      alt={`${integration.name} logo (dark)`}
                      className='hidden dark:block h-10 w-10 object-contain'
                      width={40}
                      height={40}
                    />
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className='text-muted dark:text-lightgray cursor-pointer hover:text-black dark:hover:text-white'>
                      <Icon icon='lucide:more-horizontal' width={20} />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedIntegration(integration)
                        setShowRemoveModal(true)
                      }}>
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className='mt-4'>
                <h4 className='text-lg font-semibold mb-3'>
                  {integration.name}
                </h4>
                <p className=' card-subtitle max-w-xs text-sm '>
                  {integration.desc}
                </p>
              </div>
            </div>
            <div className='flex items-center justify-between border-t border-border dark:border-darkborder  p-5 '>
              <div className='flex gap-3'>
                <Button
                  variant='outline'
                  onClick={() => setShowSettingModal(true)}>
                  <Icon icon='lucide:settings' width={19} height={19} />
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setShowDetailModal(true)}>
                  Details
                </Button>
              </div>
              <div>
                <Switch
                  checked={integration.enabled}
                  onCheckedChange={() => {
                    const updated = [...integrationStates]
                    updated[idx].enabled = !updated[idx].enabled
                    setIntegrationStates(updated)
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <SettingsModal
        open={showSettingModal}
        onClose={() => setShowSettingModal(false)}
      />
      <DetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
      <NewIntegrationModal
        open={showNewIntegrationModal}
        onClose={() => setShowNewIntegrationModal(false)}
      />
      <RemoveModal
        open={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
      />
    </Card>
  )
}

export default Integartionpage
