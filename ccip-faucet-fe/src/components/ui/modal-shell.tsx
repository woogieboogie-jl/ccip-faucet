import { FC, ReactNode } from 'react'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Reusable glass-morphism dialog wrapper used across the app

export interface ModalShellProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogContent>, 'children'> {
  title: string
  children: ReactNode
}

export const ModalShell: FC<ModalShellProps> = ({ title, children, ...props }) => (
  <DialogContent
    variant="glass"
    className="max-w-md border-0 focus:outline-none focus-visible:ring-0"
    {...props}
  >
    <DialogHeader>
      <DialogTitle className="text-white font-body text-xl font-bold text-center">
        {title}
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-6 py-4">{children}</div>
  </DialogContent>
) 