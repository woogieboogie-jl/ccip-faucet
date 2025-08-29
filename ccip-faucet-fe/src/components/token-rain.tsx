import { useMemo, useEffect, useRef, useState } from "react"
import { configService } from '@/lib/config'

const BASE_DROPLET_COUNT = 50 // Base number of droplets for visible rain effect
const CHAINLINK_BLUE = '#006FEE' // Fixed Chainlink blue color

/**
 * Animated rain shower component with crisp coins falling in unified direction.
 * Features dynamic intensity and gradual direction changes over time like real rain.
 *
 * Native tokens (configurable color from chain config) and Chainlink tokens (fixed blue) 
 * fall in opposite directions for visual distinction.
 */
export function TokenRain() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nativeThemeColor, setNativeThemeColor] = useState('#8A5CF6') // Default fallback to Monad purple
  const [isLoading, setIsLoading] = useState(true)

  // Load theme color from config
  useEffect(() => {
    const loadThemeColor = async () => {
      try {
        setIsLoading(true)
        const config = await configService.getActiveChainConfig()
        // Access the theme color from the derived config
        const themeColor = config.derivedConfig.primaryColor || '#8A5CF6' // Fallback to Monad purple
        setNativeThemeColor(themeColor)
        console.log(`🎨 TokenRain: Loaded theme color ${themeColor} for ${config.derivedConfig.nativeName}`)
      } catch (error) {
        console.error('Failed to load theme color for token rain:', error)
        // Keep default purple fallback
        setNativeThemeColor('#8A5CF6')
      } finally {
        setIsLoading(false)
      }
    }

    loadThemeColor()

    // Listen for chain changes to reload theme
    const handleChainChange = () => {
      console.log('🔄 TokenRain: Chain changed, reloading theme...')
      // Add small delay to ensure ConfigLoader.setActiveChain() completes first
      setTimeout(() => {
        loadThemeColor()
      }, 100)
    }

    // HYBRID: Restore lightweight chain listener for theme updates
    // This complements the consolidated pipeline by handling UI-specific theme state
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChange)
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChange)
      }
    }
  }, [])

  const droplets = useMemo(() => {
    return Array.from({ length: BASE_DROPLET_COUNT }, (_, idx) => {
      /**
       * Create rain-like falling pattern with crossing directions
       * Native tokens: left-to-right (configurable color from theme)
       * Chainlink tokens: right-to-left (fixed blue)
       */
      const duration = 3 + Math.random() * 2 // 3-5s consistent rain speed
      const delay = Math.random() * 8 // 0-8s staggered start for seamless loop
      const size = 12 + Math.random() * 6 // 12-18px for consistent coin sizes
      
      // Ensure perfect 50/50 split between native and chainlink tokens
      const tokenType = idx % 2 === 0 ? 'native' : 'chainlink'
      
      // Position coins based on their direction to ensure full screen coverage
      const left = tokenType === 'native' 
        ? -40 + Math.random() * 100  // Native: start from -40% to 60% (left-to-right)
        : 40 + Math.random() * 100   // Chainlink: start from 40% to 140% (right-to-left)
      
      return { idx, left, duration, delay, size, tokenType }
    })
  }, [])

  // Dynamic angle changes over time
  useEffect(() => {
    const updateAngles = () => {
      if (containerRef.current) {
        // Generate random angles for native (left-to-right) and chainlink (right-to-left)
        const nativeAngle = 40 + Math.random() * 80 // 40vw to 120vw (positive, left-to-right)
        const chainlinkAngle = -(40 + Math.random() * 80) // -40vw to -120vw (negative, right-to-left)
        
        // Update CSS custom properties
        containerRef.current.style.setProperty('--native-angle', `${nativeAngle}vw`)
        containerRef.current.style.setProperty('--chainlink-angle', `${chainlinkAngle}vw`)
      }
    }

    // Set initial angles
    updateAngles()
    
    // Change angles every 8-15 seconds for natural variation
    const interval = setInterval(() => {
      updateAngles()
    }, 8000 + Math.random() * 7000) // 8-15 seconds

    return () => clearInterval(interval)
  }, [])

  // Generate gradient colors for native tokens based on theme color
  const getNativeGradientColors = (themeColor: string) => {
    // Safety check for valid hex color
    if (!themeColor || typeof themeColor !== 'string' || !themeColor.startsWith('#')) {
      console.warn('Invalid theme color provided to TokenRain, using fallback:', themeColor)
      themeColor = '#8A5CF6' // Fallback to Monad purple
    }
    
    // Convert hex to RGB for gradient generation
    const hex = themeColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Create lighter and darker variants for gradient
    const lighter = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`
    const darker = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`
    
    return {
      from: lighter,
      via: themeColor,
      to: darker
    }
  }

  // Don't render until theme color is loaded
  if (isLoading) {
    return null
  }

  const nativeColors = getNativeGradientColors(nativeThemeColor)

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {droplets.map(({ idx, left, duration, delay, size, tokenType }) => (
        <div
          key={idx}
          className={`absolute top-[-30px] rounded-full opacity-80 border-2 shadow-lg rain-coin ${
            tokenType === 'native'
              ? "border-white/20" // Native tokens get white border
              : "border-blue-200/80 shadow-blue-400/60" // Chainlink tokens get blue border
          }`}
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            background: tokenType === 'native'
              ? `linear-gradient(135deg, ${nativeColors.from}, ${nativeColors.via}, ${nativeColors.to})`
              : `linear-gradient(135deg, #4F9EFF, ${CHAINLINK_BLUE}, #0052CC)`, // Fixed Chainlink gradient
            animation: `rain-shower-${tokenType} ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
} 