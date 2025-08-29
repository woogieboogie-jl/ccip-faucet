# Multi-Chain Configuration

This directory contains chain configuration files for the Multi-Chain CCIP Faucet supporting Monad, Ethereum, and Avalanche networks.

## Configuration Structure

The multi-chain configuration system consists of:

### chains.json
Main configuration listing all supported chains:
```json
{
  "supportedChains": ["monad-testnet", "ethereum-sepolia", "avalanche-fuji"]
}
```

### Individual Chain Configs
Each chain has its own configuration file in `chains/` directory:
- `chains/monad-testnet.json` - Monad Testnet configuration
- `chains/ethereum-sepolia.json` - Ethereum Sepolia configuration  
- `chains/avalanche-fuji.json` - Avalanche Fuji configuration

### Helper Chain Configs
Helper chains for CCIP operations in `chains/helpers/` directory:
- `chains/helpers/avalanche-fuji.json` - Volatility data provider

## chain-config.json (Legacy)

The legacy chain configuration file that serves multiple purposes:

### Structure

```json
{
  "minimal": {
    "chains": [...],
    "connectors": [...],
    "transports": {...}
  },
  "template": {
    "description": "Template for adding new chains",
    "example": {
      "chains": [...],
      "connectors": [...],
      "transports": {...}
    }
  }
}
```

### Sections

#### `minimal`
- **Purpose**: Provides a minimal wagmi config for loading states
- **Usage**: Used when the main config is still loading to prevent `useConfig` errors
- **Chains**: Single placeholder chain with ID 1
- **Connectors**: Empty array (no wallet connections during loading)
- **Transports**: HTTP transport for the placeholder chain

#### `template`
- **Purpose**: Serves as a template for adding new chains to the faucet
- **Usage**: Reference for developers when adding new chain configurations
- **Example**: Shows the structure needed for a complete chain configuration

### Adding New Chains to Multi-Chain System

To add a new chain to the multi-chain faucet:

1. **Create chain configuration file** in `chains/your-chain-name.json`:
   ```json
   {
     "name": "Your Chain Name",
     "chainId": 12345,
     "ticker": "YCN",
     "rpcUrl": "https://rpc.yourchain.com",
     "ccipRouter": "0x...",
     "linkToken": "0x...",
     "chainSelector": "123456789",
     "faucetContract": "0x...",
     "blockExplorer": "https://explorer.yourchain.com"
   }
   ```

2. **Add to supported chains list** in `chains.json`:
   ```json
   {
     "supportedChains": ["monad-testnet", "ethereum-sepolia", "avalanche-fuji", "your-chain-name"]
   }
   ```

3. **Add token icon** to `/public/tokens/ycn.png` (lowercase ticker)

4. **Deploy faucet contracts** to the new chain

5. **Update helper chain mappings** if needed

### Example Chain Configuration

```json
{
  "chains": [
    {
      "id": 1337,
      "name": "Example Chain",
      "network": "example",
      "nativeCurrency": {
        "name": "Example Token",
        "symbol": "EXT",
        "decimals": 18
      },
      "rpcUrls": {
        "default": {
          "http": ["https://rpc.example.com"]
        },
        "public": {
          "http": ["https://rpc.example.com"]
        }
      },
      "blockExplorers": {
        "default": {
          "name": "Example Explorer",
          "url": "https://explorer.example.com"
        }
      }
    }
  ],
  "connectors": ["injected", "walletConnect", "coinbaseWallet"],
  "transports": {
    "1337": "http"
  }
}
```

### File Locations

- **chain-config.json**: `/public/configs/chain-config.json`
- **Loader**: `/src/lib/chain-config-loader.ts`
- **Usage**: `/src/components/providers.tsx`

### Benefits

- ✅ **Config-Driven**: No hardcoded fallbacks
- ✅ **Template Reusable**: Easy to add new chains
- ✅ **Loading States**: Prevents wagmi errors during config loading
- ✅ **Maintainable**: Clear structure and documentation
- ✅ **Extensible**: Easy to add new sections as needed 