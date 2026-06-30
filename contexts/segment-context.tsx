
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { SegmentConfig, SegmentType, getSegmentConfig } from '@/lib/segment-config'

interface SegmentContextType {
  config: SegmentConfig
  segmentType: SegmentType
  isLoading: boolean
}

const SegmentContext = createContext<SegmentContextType | undefined>(undefined)

export function SegmentProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [segmentType, setSegmentType] = useState<SegmentType>('MEDICAL_CLINIC')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSegmentType = async () => {
      if (status === 'authenticated') {
        try {
          const response = await fetch('/api/user/profile')
          if (response.ok) {
            const data = await response.json()
            setSegmentType(data.segmentType || 'MEDICAL_CLINIC')
          }
        } catch (error) {
          console.error('Error fetching segment type:', error)
        } finally {
          setIsLoading(false)
        }
      } else if (status === 'unauthenticated') {
        setIsLoading(false)
      }
    }

    fetchSegmentType()
  }, [status])

  const config = getSegmentConfig(segmentType)

  return (
    <SegmentContext.Provider value={{ config, segmentType, isLoading }}>
      {children}
    </SegmentContext.Provider>
  )
}

export function useSegmentConfig() {
  const context = useContext(SegmentContext)
  if (context === undefined) {
    throw new Error('useSegmentConfig must be used within a SegmentProvider')
  }
  return context
}
