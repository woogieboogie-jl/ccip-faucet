import { useState, useEffect } from 'react'
import { type PublicClient } from 'viem'
import { PublicClientService } from '@/lib/public-client'

/**
 * Simple React hook for getting the public client
 * Provides loading state and error handling
 */
export function usePublicClient() {
  const [client, setClient] = useState<PublicClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const loadClient = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const publicClient = await PublicClientService.getInstance().getClient()
        setClient(publicClient)
      } catch (err) {
        console.error('Failed to load public client:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadClient()
  }, [])
  
  return { client, isLoading, error }
}

/**
 * Simple React hook for getting the helper client
 * Provides loading state and error handling
 */
export function useHelperPublicClient() {
  const [client, setClient] = useState<PublicClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const loadClient = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const helperClient = await PublicClientService.getInstance().getHelperClient()
        setClient(helperClient)
      } catch (err) {
        console.error('Failed to load helper client:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadClient()
  }, [])
  
  return { client, isLoading, error }
} 