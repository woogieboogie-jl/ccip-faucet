import { StrictMode } from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Buffer } from 'buffer'
import { configService, clearChainConfigCache } from '@/lib/config'
import { initializeConfig } from '@/lib/wagmi'
import { initializePublicClient } from '@/lib/viem'
import { ErrorBoundary } from '@/components/error-boundary'
import './index.css'
import App from './App.tsx'

// Import config test functions to make them available globally
import './lib/config-test'

// Polyfill Buffer for Web3 libraries
globalThis.Buffer = Buffer

// Clear any cached configurations to ensure fresh data
clearChainConfigCache()

// Initialize all config-driven systems
async function initializeApp() {
  try {
    console.log('🚀 Initializing config-driven systems...')
    
    // Initialize config service and apply theme
    await configService.initializeApp()
    
    // Initialize wagmi config
    await initializeConfig()
    
    // Initialize viem public client
    await initializePublicClient()
    
    console.log('✅ All config-driven systems initialized successfully')
    
    // Render the app
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (error) {
    console.error('❌ Failed to initialize config-driven systems:', error)
    
    // Render app with error boundary even if initialization fails
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    )
  }
}

// Start initialization
initializeApp() 