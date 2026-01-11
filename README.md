# 💰 Portfolio Rebalancer

A beautiful CLI tool to help you rebalance your Brazilian stock portfolio based on priority weights.

<img src="https://github.com/guscsales/rebalance/blob/main/docs/images/app-home.png?raw=true" />

## 🚀 Quick Start

### Installation

```bash
bun install
```

### Usage

```bash
bun start
```

Enter your total portfolio value when prompted. The app will fetch current prices and show you exactly what to buy!

## ⚙️ Configuration

Edit `rebalance.config.ts` to configure your assets:

```typescript
export const config: Config = {
	allowSell: false, // Set to true to see sell recommendations
	currency: "brl", // Currency (BRL only for now)
	assets: [
		{ticker: "BBAS3", priority: 5, quantity: 477},
		{ticker: "XPLG11", priority: 8, quantity: 181},
		// Add your assets here
	],
};
```

- **ticker**: Stock ticker (will get `.SA` suffix automatically)
- **priority**: Weight/priority (higher = larger allocation)
- **quantity**: Number of shares you currently own

## 🎮 Controls

- **Enter**: Submit portfolio value / Confirm
- **r**: Refresh config & prices (edit config, then press `r`)
- **Esc**: Exit

## ✨ Features

- 🎨 Beautiful CLI interface with Ink (React for CLI)
- 💰 Auto-formatted Brazilian currency input
- 📊 Real-time price fetching from Yahoo Finance
- 🔄 Hot-reload config (edit & press `r` to reload)
- 📈 Summary box with key metrics
- 🚫 "No Sell" mode (only shows buy recommendations)
- 🎯 Calculates exact quantities to buy

## 📦 Tech Stack

- **Bun** - Runtime
- **TypeScript** - Language
- **Ink** - React for CLI
- **React Query** - Data fetching
- **boxen** - Beautiful boxes

## 🛠️ Development

```bash
bun dev  # Watch mode
```

---

Made with ❤️ for Brazilian investors
