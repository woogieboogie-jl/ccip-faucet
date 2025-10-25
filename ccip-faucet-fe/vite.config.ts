import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from the project root
  const envDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, envDir, '')
  
  console.log('🔧 Loaded environment variables from:', envDir)
  console.log('🔍 Mode:', mode)
  console.log('📁 Vite will look for these files in order:')
  console.log('   1. .env.local')
  console.log('   2. .env.' + mode + '.local') 
  console.log('   3. .env.' + mode)
  console.log('   4. .env')
  console.log('📋 Environment variables found from .env files:', Object.keys(env).filter(k => 
    k.includes('FAUCET') || k.includes('HELPER') || k.includes('MONAD') || k.includes('AVALANCHE') || k.includes('PIMLICO') || k.includes('VITE_')
  ))
  console.log('📋 Environment variables found in process.env:', Object.keys(process.env).filter(k => 
    k.includes('FAUCET') || k.includes('HELPER') || k.includes('MONAD') || k.includes('AVALANCHE') || k.includes('PIMLICO') || k.includes('VITE_')
  ))

  // Auto-create VITE_ variables from base variables
  const createEnvMapping = () => {
    const envMapping: Record<string, string> = {}
    
    console.log('🔧 Auto-creating VITE_ variables from base variables...')
    
    // Dynamically expose relevant environment variables from .env file as VITE_ variables
    // Only include variables that are actually needed by the frontend
    const shouldExposeToFrontend = (key: string): boolean => {
      return (
        // Include RPC URLs for all chains
        key.endsWith('_RPC_URL') ||
        // Include API keys (but exclude private keys)
        (key.includes('API_KEY') && !key.includes('PRIVATE_KEY')) ||
        // Include specific frontend-relevant variables
        key === 'POLICY_ID' ||
        key === 'WALLETCONNECT_PROJECT_ID' ||
        // Exclude already prefixed VITE_ vars (they'll be handled separately)
        false
      ) && !key.startsWith('VITE_') && !key.includes('PRIVATE_KEY') && !key.includes('SECRET')
    }
    
    // Get all environment variables from .env file that should be exposed
    const exposeAsVite = Object.keys(env).filter(shouldExposeToFrontend)
    
    console.log('🎯 Found environment variables to expose:', exposeAsVite)
    
    // Auto-create VITE_ versions of base variables
    exposeAsVite.forEach(baseVar => {
      const viteVar = `VITE_${baseVar}`
      // Check in this order: loaded env file, process.env, VITE_ versions
      const value = env[baseVar] || process.env[baseVar] || env[viteVar] || process.env[viteVar]
      
      console.log(`🔍 Checking ${baseVar}: ${value ? 'FOUND' : 'NOT FOUND'}`)
      if (value) {
        console.log(`   📍 Found in: ${env[baseVar] ? '.env file' : process.env[baseVar] ? 'process.env' : 'VITE_ variant'}`)
      }
      
      if (value) {
        envMapping[`import.meta.env.${viteVar}`] = JSON.stringify(value)
        console.log(`🔗 ${baseVar} -> ${viteVar} = ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`)
      } else {
        console.warn(`⚠️  ${baseVar} not found in environment`)
      }
    })
    
    // Also include any existing VITE_ variables not covered above
    Object.keys(env).forEach(key => {
      if (key.startsWith('VITE_') && !envMapping[`import.meta.env.${key}`]) {
        const value = env[key]
        if (value) {
          envMapping[`import.meta.env.${key}`] = JSON.stringify(value)
          console.log(`✅ ${key} = ${value}`)
        }
      }
    })
    
    console.log(`🎯 Created ${Object.keys(envMapping).length} VITE_ environment variables`)
    console.log('📦 Final mapping:', envMapping)
    return envMapping
  }

  return {
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: 'buffer',
    },
  },
  define: {
    global: 'globalThis',
      // Auto-map all environment variables
      ...createEnvMapping(),
  },
  optimizeDeps: {
    include: ['buffer', 'immer'],
  },
    // Load env vars from the project root where .env file is located
    envDir: envDir,
    server: {
      fs: {
        // Allow accessing files outside the workspace package (monorepo root)
        allow: ['..', path.resolve(__dirname, '..')],
      },
    },
  }
}) 
