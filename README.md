# Multi-Chain CCIP Faucet

A sophisticated, cross-chain faucet application built for multiple testnets including Monad, Ethereum Sepolia, and Avalanche Fuji. This project features gas-sponsorship for new users via Account Abstraction (Pimlico) and dynamically-adjusted drip rates powered by real-world volatility data from Avalanche Fuji, delivered via Chainlink CCIP.

It is designed to serve two primary user flows:

* **Initial Users (No Gas)**: A seamless, gas-free experience using Account Abstraction
* **Standard Users**: Direct interaction for users who already have native tokens in their EOA wallets

## 🏛️ Architecture

This project's architecture is designed for robustness and decentralization, spanning multiple blockchains and off-chain infrastructure to provide a seamless user experience.

* **User Onboarding (Multi-Chain)**: A dual-flow system handles both new, gas-less users via an EIP-4337 Account Abstraction stack (Pimlico) and traditional users via standard EOA transactions
* **Central Application (Active Chains)**: The `Faucet.sol` contract acts as the central hub, dispensing native tokens (MON, AVAX, ETH) and LINK tokens with dynamic drip amounts based on volatility data
* **Cross-Chain Backend (Fuji & CCIP)**: When the faucet runs low or needs volatility updates, it uses Chainlink CCIP to request data from a `VolatilityHelper.sol` contract on the Avalanche Fuji testnet. This helper fetches real-world volatility data from Chainlink Data Feeds, allowing the faucet to dynamically adjust its drip rates
* **Frontend (Vite + React)**: A modern React application with real-time updates, multi-chain support, dynamic network switching, and optimized RPC batching for superior performance

## 📁 Project Structure

```
ccip-faucet/
├── ccip-faucet-contracts/         # Smart contracts (Foundry)
│   ├── src/
│   │   ├── Faucet.sol             # Main faucet contract (Multi-chain)
│   │   └── VolatilityHelper.sol   # Volatility oracle (Avalanche Fuji)
│   ├── script/                    # Deployment scripts
│   ├── DEPLOYMENT.md              # Contract deployment guide
│   └── README.md                  # Contract documentation
├── ccip-faucet-fe/                # Frontend application (Vite + React)
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── ui/               # shadcn/ui components
│   │   │   ├── header.tsx        # Navigation with balance display
│   │   │   ├── faucet-section.tsx # Main faucet interface
│   │   │   ├── vault-status.tsx  # Vault management with fuel buttons
│   │   │   ├── network-switching-modal.tsx # Chain switching UI
│   │   │   └── ...
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── use-global-ccip.ts    # Universal CCIP state
│   │   │   ├── use-faucet.ts         # Token distribution logic
│   │   │   ├── use-volatility.ts     # BTC volatility tracking
│   │   │   ├── use-public-client.ts  # Public client management
│   │   │   └── ...
│   │   ├── lib/                  # Utilities and configurations
│   │   │   ├── config/           # Multi-chain configuration system
│   │   │   ├── wagmi.ts          # Web3 configuration
│   │   │   ├── utils.ts          # Tailwind utilities
│   │   │   └── account-abstraction.ts
│   │   └── pages/
│   │       └── HomePage.tsx      # Main application page
│   ├── public/
│   │   ├── configs/              # Chain configuration files
│   │   │   ├── chains/           # Individual chain configs
│   │   │   │   ├── monad-testnet.json
│   │   │   │   ├── ethereum-sepolia.json
│   │   │   │   └── avalanche-fuji.json
│   │   │   └── chains/helpers/   # Helper chain configs
│   │   └── tokens/               # Token icons (MON, AVAX, ETH, LINK)
│   └── README.md                 # Frontend documentation
├── package.json                  # Root package configuration
├── pnpm-workspace.yaml          # Workspace configuration
├── turbo.json                   # Build orchestration
├── vercel.json                  # Deployment configuration
├── preflight-check.ts           # TypeScript pre-flight checks
├── preflight-check.sh           # Shell script pre-flight checks
└── README.md                    # This file
```

## 🚀 Quick Start & Deployment

### Prerequisites

* **Node.js 18+**
* **pnpm** (recommended package manager)
* **Git**
* **Foundry** (for smart contract deployment)
* **Wallet with testnet funds** (for contract deployment)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/ccip-faucet.git
cd ccip-faucet
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This will install dependencies for both the contracts and frontend workspaces.

### Step 3: Deploy Smart Contracts

Navigate to the contracts directory and follow the comprehensive deployment guide:

```bash
cd ccip-faucet-contracts
```

**Important**: Follow the step-by-step deployment instructions in `ccip-faucet-contracts/DEPLOYMENT.md`. This includes:

1. Setting up your `.env` file with RPC URLs and private keys
2. Deploying `Faucet.sol` to your chosen active chain (Monad, Ethereum Sepolia, or Avalanche Fuji)
3. Deploying `VolatilityHelper.sol` to Avalanche Fuji
4. Configuring cross-chain communication
5. Funding contracts with LINK tokens
6. Verifying contracts on block explorers

### Step 4: Configure Environment Variables

The project uses a **unified .env system** with automatic VITE_ prefixing for frontend variables:

```bash
# Copy the example file (from project root)
cp .env.example .env
```

Fill in your `.env` file with:

```bash
# ── secrets / scripts ───────────────────────────────
FAUCET_PRIVATE_KEY=your_private_key_here
PIMLICO_API_KEY=your_pimlico_api_key
MONAD_TESTNET_RPC_URL=your_monad_rpc_url
AVALANCHE_FUJI_RPC_URL=your_avalanche_rpc_url
ETHEREUM_SEPOLIA_RPC_URL=your_ethereum_rpc_url

# ── browser-exposed vars ────────────────────────────
POLICY_ID=your_policy_id
WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Contract Addresses (updated automatically by deployment scripts)
# These will be populated from your chain configuration files
```

**🔧 Important Environment Setup Notes:**

- **Unified .env**: The `.env` file in the project root is shared between contracts and frontend
- **Auto VITE_ Prefixing**: Variables like `WALLETCONNECT_PROJECT_ID` automatically become `VITE_WALLETCONNECT_PROJECT_ID` for frontend access
- **Symlinked Setup**: The frontend `.env` is symlinked to the root `.env` for consistency
- **No Hardcoded Addresses**: Contract addresses are stored in JSON config files, not environment variables

### Step 5: Run the Frontend

From the frontend directory, start the development server:

```bash
cd ccip-faucet-fe
npm run dev
```

The application will be available at `http://localhost:5174`

**Note**: The frontend automatically detects and converts environment variables with VITE_ prefixing as shown in the terminal output.

## 🛠️ Available Scripts

From the root directory:

```bash
# Development
pnpm run dev              # Start frontend development server
pnpm run build            # Build all workspaces
pnpm run build:frontend   # Build frontend only
pnpm run build:contracts  # Build contracts only

# Testing & Validation
pnpm run preflight        # Run comprehensive pre-flight checks
pnpm run test             # Run all tests
pnpm run test:contracts   # Run contract tests
pnpm run test:frontend    # Run frontend tests

# Deployment
pnpm run deploy:contracts # Deploy contracts (see DEPLOYMENT.md)
pnpm run deploy:frontend  # Deploy frontend to Vercel
```

## 🌐 Deployment to Production

### Frontend Deployment (Vercel)

The frontend is configured for automatic deployment to Vercel:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard matching your `.env`
3. **Deploy** - Vercel will automatically detect the Vite app and deploy

The `vercel.json` configuration handles:

* Build command optimization
* Static file routing
* Environment-specific configurations

### Contract Deployment

Contracts can be deployed to any supported chain:

* **Monad Testnet**: Faucet.sol (Chain ID: 10143)
* **Ethereum Sepolia**: Faucet.sol (Chain ID: 11155111)
* **Avalanche Fuji**: Faucet.sol + VolatilityHelper.sol (Chain ID: 43113)

See `ccip-faucet-contracts/DEPLOYMENT.md` for detailed deployment instructions.

## 🔧 Key Features

### Smart Contracts

* **Multi-chain faucet** with native token (MON/AVAX/ETH) and LINK token dispensing
* **Dynamic drip rates** based on real-world volatility data
* **Cross-chain communication** via Chainlink CCIP
* **Dual-reservoir system** with vault and tank architecture
* **Admin controls** for managing cooldowns, capacities, and emergency operations

### Frontend

* **Multi-chain support** with dynamic network switching
* **Account Abstraction** support for gas-free transactions
* **Real-time updates** with optimized RPC batching
* **Dynamic UI theming** based on selected network
* **Network switching modal** with visual chain indicators
* **Balance displays** with chain-specific token icons
* **Responsive design** with modern UI components
* **Performance optimized** with efficient state management

### Architecture Benefits

* **Multi-chain**: Supports multiple active chains with unified interface
* **Decentralized**: No single point of failure
* **Scalable**: Modular design supports easy expansion to new chains
* **User-friendly**: Both gas-free and traditional transaction flows
* **Data-driven**: Real-world volatility affects token distribution
* **Configuration-driven**: Easy chain addition via JSON configs

## 🧪 Testing

### Contract Testing

```bash
cd ccip-faucet-contracts
forge test
```

### Frontend Testing

```bash
cd ccip-faucet-fe
pnpm run test
```

### Pre-Flight Checks

Before triggering CCIP operations, run comprehensive checks:

```bash
# TypeScript version with detailed error reporting
pnpm run preflight

# Shell script version using cast and jq
./preflight-check.sh
```

The pre-flight scripts verify:

- ✅ **Contract Deployments**: Both faucet and helper contracts exist
- ✅ **Cross-Chain Mappings**: Proper whitelisting between contracts
- ✅ **LINK Balances**: Sufficient LINK tokens for CCIP fees
- ✅ **Volatility Feed**: Oracle connectivity and data validity
- ✅ **Faucet State**: Ready for refill (not in progress, needs refill)
- ✅ **Owner Verification**: Consistent ownership across contracts

## 📚 Documentation

* **Contract Documentation**: `ccip-faucet-contracts/DEPLOYMENT.md`
* **Frontend Documentation**: `ccip-faucet-fe/README.md`
* **Configuration Guide**: `ccip-faucet-fe/public/configs/README.md`

## 🔧 Configuration

### Multi-Chain Configuration System

All addresses and chain parameters are stored in JSON configuration files:

* **Supported Chains**: `ccip-faucet-fe/public/configs/chains.json`
* **Individual Chain Configs**: `ccip-faucet-fe/public/configs/chains/*.json`
* **Helper Chain Configs**: `ccip-faucet-fe/public/configs/chains/helpers/*.json`

Environment variables are only used for secrets (private keys, RPC URLs, API keys).

### Adding New Chains

To add support for a new chain:

1. Create chain configuration file in `ccip-faucet-fe/public/configs/chains/your-chain.json`
2. Add chain name to supported chains list in `chains.json`
3. Add token icon to `ccip-faucet-fe/public/tokens/`
4. Deploy faucet contracts to the new chain
5. Update helper chain mappings if needed

## 🚨 Troubleshooting

### Common Issues

1. **"Volatility feed check failed"**
   - Update the `volatilityFeed` address in your helper chain JSON
   - Redeploy the helper contract with correct oracle address

2. **"Invalid sender" on helper chain**
   - Ensure `ConfigureFaucet` and `ConfigureHelper` scripts were run
   - Verify cross-chain mappings in pre-flight checks

3. **"Insufficient LINK"**
   - Fund both contracts: `forge script FundContracts`

4. **"Contract not found"**
   - Verify addresses in JSON configs match deployed contracts
   - Check you're on the correct network

5. **Network switching not working**
   - Ensure wallet is connected and has the target network added
   - Check that chain configuration files are properly formatted

### Getting Help

- Run pre-flight checks first: `pnpm run preflight`
- Check deployment guide: `ccip-faucet-contracts/DEPLOYMENT.md`
- Verify JSON configurations are updated with deployed addresses
- Check console logs for detailed error messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🚨 Security Notice

This is a testnet application. Do not use with mainnet funds. Always verify contract addresses and transaction details before signing.

## 🔗 Links

* **Live Demo**: [Your Vercel Deployment URL]
* **Chainlink CCIP**: https://chain.link/cross-chain
* **Pimlico**: https://pimlico.io
* **Monad**: https://monad.xyz
* **Reference Implementation**: https://github.com/0xDocu/monad-ccip-faucet

---

**Happy Multi-Chain Building!** 🚀

For detailed deployment instructions, see the README files in each workspace directory.