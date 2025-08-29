import { Routes, Route } from 'react-router-dom'
import { Providers } from '@/components/providers'
import { HomePage } from '@/pages/HomePage'
import { useCooldownManager } from '@/hooks/use-cooldown-manager'

function App() {
  // Initialize centralized cooldown timer for the entire app
  useCooldownManager()

  return (
    <Providers>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Providers>
  )
}

export default App 