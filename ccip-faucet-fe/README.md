# 🎯 Multi-Chain CCIP Faucet

**Cross-Chain Token Distribution Powered by Chainlink CCIP** 

A modern multi-chain faucet dApp built with **Vite + React + Wagmi + Viem** featuring cross-chain CCIP volatility-based token distribution with dynamic network switching and token rain animations.

## ✨ Features

### 🌊 Multi-Chain Token System
- **Native Tokens**: Chain-specific native tokens (MON, AVAX, ETH) with dynamic theming
- **LINK Tokens**: Chainlink tokens available across all supported chains
- **Vault → Tank**: Two-tier distribution system with deep reserves and immediate drip pools
- **Dynamic Chain Switching**: Seamless network switching with automatic UI updates

### 🌐 CCIP Cross-Chain Integration
- **Universal Volatility Requests**: Real-time BTC-based crypto volatility fetching
- **Multi-Chain Token Requests**: Independent native token and LINK fuel button requests
- **Progress Tracking**: Live progress bars with message IDs and transaction hashes
- **Phase Indicators**: Detailed status updates through 5 phases of CCIP operations
- **Cross-Chain Messaging**: Seamless communication between active and helper chains

### 🎨 Premium UX
- **Token Rain Animation**: Dynamic falling coins with angled trajectories and rotation
- **Dynamic Theming**: Chain-specific color schemes and branding
- **Enhanced Drip Animation**: Success feedback with scaling and green glow effects
- **Network Switching Modal**: Intuitive chain selection with visual indicators
- **Responsive Design**: Perfect on desktop and mobile with adaptive layouts

### ⚡ Gas-Free Onboarding
- **Account Abstraction**: Powered by Pimlico/Alchemy for gasless first transactions
- **Smart Wallet Integration**: Automatic smart contract wallet creation
- **Paymaster Support**: Sponsored transactions for new users

### 🛠️ Web3 Stack
- **Wagmi v2.15.2**: Type-safe Ethereum interactions
- **Viem v2.31.0**: Low-level Ethereum utilities  
- **Permissionless.js v0.2.0**: Account abstraction primitives
- **React Query**: Async state management for Web3 calls

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Clone and enter directory
cd ccip-faucet-fe

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys:
# - VITE_WALLETCONNECT_PROJECT_ID
# - VITE_INFURA_API_KEY  
# - VITE_ALCHEMY_API_KEY

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## 🏗️ Architecture

### Directory Structure
```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── header.tsx       # Navigation with CCIP progress
│   ├── faucet-section.tsx
│   ├── tank-status.tsx  # Tank management with fuel buttons
│   ├── token-rain.tsx   # Background animation
│   └── ...
├── hooks/               # Custom React hooks
│   ├── use-global-ccip.ts    # Universal CCIP state
│   ├── use-faucet.ts         # Token distribution logic
│   ├── use-volatility.ts     # BTC volatility tracking
│   ├── use-public-client.ts  # Public client management
│   └── ...
├── lib/                 # Utilities and configurations
│   ├── wagmi.ts         # Web3 configuration
│   ├── utils.ts         # Tailwind utilities
│   ├── public-client.ts # Centralized client service
│   └── account-abstraction.ts
└── pages/
    └── HomePage.tsx     # Main application page
```

### PublicClientService Architecture

**Centralized Client Management**
- **Singleton Pattern**: Single instance managing all Viem public clients
- **Config-Driven**: Clients created from chain configuration files
- **Caching**: Clients cached to avoid repeated creation
- **Error Handling**: Proper error states and fallbacks

**Key Benefits**
- **Reduced RPC Calls**: Clients reused across components
- **Config Consistency**: All clients use same configuration source
- **Type Safety**: Full TypeScript support with proper types
- **Performance**: Lazy loading and caching for optimal performance

**Usage Examples**
```typescript
// Direct service usage
const client = await PublicClientService.getInstance().getClient()

// React hook usage
const { client, isLoading, error } = usePublicClient()
const { client: helperClient } = useHelperPublicClient()
```

### Key Components

**Global CCIP State Management**
- Separate MON/LINK request tracking
- Universal volatility data sharing
- Real-time progress updates with phases

**Tank Status Integration**
- Fuel buttons embedded in tank cards
- Token-specific progress display
- Success animations with drip effects

**Multi-Chain Architecture**
- **Dynamic Chain Detection**: Automatic detection of connected wallet's network
- **Chain Configuration System**: JSON-based configuration for easy chain addition
- **Cross-Chain State Management**: Unified state across different networks
- **Network Switching**: Seamless switching between supported chains
- **Chain-Specific UI**: Dynamic theming and token displays per network

**Web3 Provider Setup**
- Multi-chain support (Monad, Ethereum, Avalanche)
- Multiple wallet connectors (MetaMask, WalletConnect, Coinbase)
- Account abstraction for gasless transactions

## 🎯 CCIP Workflow

1. **User clicks fuel button** → Triggers volatility request
2. **Fetching BTC volatility** → Cross-chain CCIP message sent  
3. **Processing response** → Volatility data received and processed
4. **Updating drip rates** → Token amounts adjusted based on volatility
5. **Vault→Tank refill** → Automatic tank replenishment

## 🎨 Design System

### Colors
- **Monad Purple**: `#8A5CF6` (medium purple, matching brand)
- **Chainlink Blue**: `#006FEE` (bright blue, matching brand)
- **Mid-Color**: `#4566F2` (blend between purple and blue)
- **Gradient Background**: Purple → Mid-Color → Blue horizontal gradient

### Typography
- **Poster Font**: Impact, Arial Black for headlines
- **Body Font**: Inter Tight for UI text
- **Mono Font**: JetBrains Mono for addresses/hashes

### Animations
- **Token Rain**: CSS keyframes with random angles and speeds
- **Drip Success**: Scaling + green glow feedback
- **Progress Bars**: Smooth transitions with phase indicators

## 🔧 Configuration

### Environment Variables
```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_INFURA_API_KEY=your_infura_key
VITE_ALCHEMY_API_KEY=your_alchemy_key
```

### Supported Networks
- **Monad Testnet** (Chain ID: 10143) - Primary deployment
- **Ethereum Sepolia** (Chain ID: 11155111) - Testnet deployment  
- **Avalanche Fuji** (Chain ID: 43113) - Helper chain for volatility data
- Extensible configuration system for additional chains

## 🧪 Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run preview` - Preview production build
- `npm run lint` - ESLint checking

### Tech Stack
- **Framework**: Vite 6.3.5 + React 19.1.0
- **Web3**: Wagmi 2.15.2 + Viem 2.31.0
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **TypeScript**: Full type safety

## 📱 Mobile Support

The application is fully responsive with:
- Adaptive layouts for mobile/tablet/desktop
- Touch-friendly interactions
- Optimized token rain for mobile performance
- Mobile-first navigation patterns

## 🔒 Security

- **Client-side only**: No server-side data exposure
- **Wallet-based authentication**: No username/password required
- **Gas-sponsored transactions**: Safe account abstraction patterns
- **Environment variable protection**: Sensitive keys in .env files

---

**Built with ❤️ using the latest Web3 technologies** 