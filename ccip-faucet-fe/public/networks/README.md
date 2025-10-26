# Network Logo Directory

This directory contains chain-specific branding logos used for network identity in the UI (network selector, headers, etc.).

## File Naming Convention

Network logos should be named using the **chain name in kebab-case** to match the configuration file names:

```
networks/
  ├── monad-testnet.png
  ├── avalanche-fuji.png
  ├── arbitrum-sepolia.png
  ├── ethereum-sepolia.png
  └── [chain-name].png
```

## Distinction from Token Icons

- **Network Logos** (`/networks/`): Chain-specific branding and identity
  - Example: Arbitrum blue logo, Avalanche red logo
  - Used in: Network selector, page headers, chain identification
  
- **Token Icons** (`/tokens/`): Token-specific icons (can be shared across chains)
  - Example: ETH logo (used by both Ethereum and Arbitrum)
  - Used in: Balance displays, transaction amounts, token transfers

## Recommended Specifications

- **Format**: PNG with transparency
- **Size**: 64x64px or 128x128px (will be scaled automatically)
- **Style**: Official chain branding or recognizable network icon
- **Background**: Transparent

## Example

For Arbitrum Sepolia:
- **Config file**: `chains/arbitrum-sepolia.json`
- **Network logo**: `networks/arbitrum-sepolia.png` ← Arbitrum blue logo
- **Token icon**: `tokens/eth.png` ← Generic ETH logo (shared with Ethereum Sepolia)

This separation allows multiple chains with the same native token (ETH) to have distinct visual identities.

