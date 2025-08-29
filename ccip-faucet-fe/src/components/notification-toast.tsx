import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number
}

interface NotificationToastProps {
  notification: Notification
  onDismiss: (id: string) => void
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animate in
    setIsVisible(true)
    
    // Auto-dismiss after duration (default 5 seconds)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onDismiss(notification.id), 300) // Wait for exit animation
    }, notification.duration || 5000)

    return () => clearTimeout(timer)
  }, [notification.id, notification.duration, onDismiss])

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />
    }
  }

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-500/20 border-green-400/30'
      case 'error':
        return 'bg-red-500/20 border-red-400/30'
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-400/30'
      case 'info':
        return 'bg-blue-500/20 border-blue-400/30'
    }
  }

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-[9999] max-w-sm w-full',
        'transform transition-all duration-300 ease-in-out',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <div className={cn(
        'rounded-lg border p-4 shadow-lg backdrop-blur-sm',
        getBackgroundColor()
      )}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm font-medium text-white">
              {notification.title}
            </p>
            <p className="font-body text-xs text-white/80 mt-1">
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false)
              setTimeout(() => onDismiss(notification.id), 300)
            }}
            className="flex-shrink-0 text-white/60 hover:text-white/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Notification manager hook
export function useNotificationManager() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newNotification = { ...notification, id }
    setNotifications(prev => [...prev, newNotification])
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const showSuccess = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'success', title, message, duration })
  }

  const showError = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'error', title, message, duration })
  }

  const showInfo = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'info', title, message, duration })
  }

  const showWarning = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'warning', title, message, duration })
  }

  return {
    notifications,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeNotification
  }
}

// Notification container component
export function NotificationContainer() {
  const { notifications, removeNotification } = useNotificationManager()

  return (
    <div className="fixed top-0 right-0 z-[9999] p-4 space-y-2">
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={removeNotification}
        />
      ))}
    </div>
  )
} 