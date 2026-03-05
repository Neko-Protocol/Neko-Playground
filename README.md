<p align="center">
  <img width="2940" height="770" alt="Neko DApp Banner" src="https://github.com/user-attachments/assets/c8adcc67-4f7d-453e-804a-1cf14be0e582" />
</p>

<h1 align="center">Neko DApp</h1>

<p align="center">
  <strong>A multi-chain DeFi protocol for Real-World Assets on Stellar and EVM networks</strong>
</p>

<p align="center">
  Liquidity pools • Lending & Borrowing • Perpetual Futures • RWA Tokenization • Portfolio Management
</p>

## Features

| Feature                 | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| **Dashboard**           | Real-time portfolio analytics and performance metrics       |
| **Liquidity Pools**     | Manage and track NFT-based liquidity positions via SoroSwap |
| **Lending & Borrowing** | Participate in DeFi lending markets with RWA collateral     |
| **Perpetual Futures**   | Trade perpetual contracts for RWA stocks                    |
| **Token Swap**          | Seamless token exchange via CoW Swap                        |
| **RWA Oracle**          | SEP-40 compliant price feeds for Real-World Assets          |
| **Multi-Chain**         | Support for both Stellar (Soroban) and EVM networks         |

## Quick Start

### Prerequisites

Before getting started, ensure you have:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v10.2.3 or higher)
- [Rust](https://www.rust-lang.org/tools/install) (v1.70 or higher)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools) (v23.1.0 or higher, required for oracle bindings)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Neko-Protocol/Neko-DApp.git
   cd Neko-DApp
   ```

2. **Install Stellar CLI** (required for generating oracle contract bindings):

   **Linux:**

   ```bash
   curl -sSLO https://github.com/stellar/stellar-cli/releases/latest/download/stellar-cli-x86_64-unknown-linux-gnu.tar.gz
   tar -xzf stellar-cli-*.tar.gz
   sudo mv stellar /usr/local/bin/
   ```

   **macOS (Intel):**

   ```bash
   curl -sSLO https://github.com/stellar/stellar-cli/releases/latest/download/stellar-cli-x86_64-apple-darwin.tar.gz
   tar -xzf stellar-cli-*.tar.gz
   sudo mv stellar /usr/local/bin/
   ```

   **macOS (Apple Silicon):**

   ```bash
   curl -sSLO https://github.com/stellar/stellar-cli/releases/latest/download/stellar-cli-aarch64-apple-darwin.tar.gz
   tar -xzf stellar-cli-*.tar.gz
   sudo mv stellar /usr/local/bin/
   ```

   **Alternative (with Cargo):**

   ```bash
   cargo install --git https://github.com/stellar/stellar-cli --locked stellar-cli
   ```

   Verify installation:

   ```bash
   stellar --version
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Build contract packages:**

   ```bash
   npm run build
   ```

   This will build all contract packages in the monorepo.

5. **Set up environment variables:**

   Create a `.env.local` file in `apps/web-app/`:

   ```env
   # Stellar Network Configuration
   NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
   NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
   NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

   # SoroSwap ApiKey
   NEXT_PUBLIC_SOROSWAP_API_KEY=your_api_key_here
   ```

6. **Start the development server:**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## Project Structure

This is a monorepo managed with [Turborepo](https://turbo.build/repo) and npm workspaces:

```
neko-dapp/
├── .agents/
│   └── skills/                    # AI Agent skills for Claude Code
│       ├── stellar-dev/           # Stellar/Soroban development playbook
│       ├── tanstack-query/        # TanStack Query v5 patterns
│       ├── tailwind-patterns/     # Tailwind CSS component patterns
│       ├── next-best-practices/   # Next.js optimization guidelines
│       ├── vercel-react-best-practices/  # React performance patterns
│       ├── vercel-composition-patterns/  # Component composition patterns
│       ├── remotion-best-practices/      # Video creation with Remotion
│       ├── commit-work/           # Git commit best practices
│       ├── seo-audit/             # Technical SEO audit
│       ├── web-design-guidelines/ # UI/UX review guidelines
│       ├── agent-md-refactor/     # AGENTS.md refactoring
│       ├── skill-creator/         # Guide for creating skills
│       └── find-skills/           # Skill discovery and installation
│
├── .claude/
│   └── skills -> ../.agents/skills   # Symbolic link for Claude Code
│
├── CLAUDE.md                      # Project instructions for Claude Code
│
├── apps/
│   ├── web-app/                    # Next.js 16 + React 19 web application
│   │   ├── src/
│   │   │   ├── app/                # Next.js App Router
│   │   │   │   ├── (marketing)/    # Marketing/landing pages
│   │   │   │   ├── api/            # API routes
│   │   │   │   └── dashboard/      # Dashboard routes
│   │   │   │       ├── borrowing/
│   │   │   │       ├── lending/
│   │   │   │       ├── pools/
│   │   │   │       ├── stocks/
│   │   │   │       └── swap/
│   │   │   ├── features/           # Feature-based modules
│   │   │   │   ├── borrowing/      # Borrow feature
│   │   │   │   ├── lending/        # Lend feature
│   │   │   │   ├── stocks/         # RWA Stocks/Oracle feature
│   │   │   │   ├── swap/           # Token swap feature
│   │   │   │   ├── pools/          # Liquidity pool management
│   │   │   │   ├── wallet/         # Wallet integration
│   │   │   │   └── dashboard/      # Dashboard overview
│   │   │   ├── components/         # Shared UI components
│   │   │   │   ├── ui/             # Reusable UI primitives
│   │   │   │   ├── charts/         # Chart components
│   │   │   │   ├── layout/         # Layout components
│   │   │   │   └── navigation/     # Navigation components
│   │   │   ├── contracts/          # Contract interaction utilities
│   │   │   ├── debug/              # Debug utilities
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   ├── lib/                # Shared utilities
│   │   │   │   ├── config/         # App configuration
│   │   │   │   ├── constants/      # Constants and generated types
│   │   │   │   ├── helpers/        # Helper functions
│   │   │   │   ├── services/       # External service integrations
│   │   │   │   └── types/          # TypeScript type definitions
│   │   │   ├── providers/          # Context providers
│   │   │   │   ├── WalletProvider  # Multi-chain wallet support
│   │   │   │   └── NotificationProvider
│   │   │   └── stores/             # Zustand state stores
│   │   │       ├── user.store.ts
│   │   │       ├── wallet.store.ts
│   │   │       └── session.store.ts
│   │   └── public/                 # Static assets
│   │
│   └── contracts/                  # Smart contracts
│       ├── stellar-contracts/      # Stellar/Soroban contracts (Rust)
│       │   ├── rwa-oracle/         # SEP-40 Oracle for RWA price feeds
│       │   ├── rwa-token/          # RWA Token with oracle integration
│       │   ├── rwa-lending/        # Lending protocol (Blend-based)
│       │   └── rwa-perps/          # Perpetual futures (in development)
│       └── evm-contracts/          # EVM/Solidity contracts (Foundry)
│           └── rwa-lending/        # RWA Lending with Pyth oracle
│
├── packages/
│   ├── config/                     # Shared configuration
│   │   ├── eslint.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.mjs
│   │   └── tsconfig.json
│   └── contracts/                  # TypeScript contract clients
│       ├── oracle/                 # @neko/oracle
│       └── lending/                # @neko/lending
│
├── turbo.json                      # Turborepo configuration
└── package.json                    # Root package.json (npm workspaces)
```

## Available Scripts

### Root Level

- `npm run dev` - Start all development servers (web app)
- `npm run build` - Build all packages and apps for production
- `npm run start` - Start production servers
- `npm run lint` - Run ESLint across all packages
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Web App Specific

- `cd apps/web-app && npm run dev` - Start Next.js dev server with Turbopack
- `cd apps/web-app && npm run build` - Build Next.js app for production
- `cd apps/web-app && npm run start` - Start Next.js production server
- `cd apps/web-app && npm run lint` - Run ESLint

## Technology Stack

### Frontend

| Technology          | Version  | Description                     |
| ------------------- | -------- | ------------------------------- |
| Next.js             | 16.1     | React framework with App Router |
| React               | 19.2     | UI library                      |
| Turbopack           | Built-in | Fast bundler for development    |
| Tailwind CSS        | 4.x      | Utility-first CSS framework     |
| Zustand             | -        | Lightweight state management    |
| TanStack Query      | -        | Server state management         |
| Chart.js / Recharts | -        | Data visualization              |

### Blockchain Integration

| Network     | Technologies                                            |
| ----------- | ------------------------------------------------------- |
| **Stellar** | @stellar/stellar-sdk, Stellar Wallets Kit, SoroSwap SDK |
| **EVM**     | viem, wagmi, RainbowKit, CoW Swap SDK                   |

### Smart Contracts

| Platform            | Language | Framework        | Standards      |
| ------------------- | -------- | ---------------- | -------------- |
| **Stellar/Soroban** | Rust     | Soroban SDK 23.x | SEP-40, SEP-41 |
| **EVM**             | Solidity | Foundry          | Pyth Oracle    |

### Monorepo

- **Build System**: Turborepo
- **Package Manager**: npm workspaces (v10.2.3+)
- **Code Quality**: ESLint 9, Prettier 3, Husky 9

## Architecture

### Smart Contract Architecture

The Stellar contracts follow a layered dependency structure:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Neko Protocol                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    prices    ┌──────────────┐               │
│   │  RWA Oracle  │─────────────▶│  RWA Token   │               │
│   │   (SEP-40)   │              │   (SEP-41)   │               │
│   └──────┬───────┘              └──────┬───────┘               │
│          │                             │                        │
│          │ prices + metadata           │ collateral             │
│          │                             │                        │
│          ▼                             ▼                        │
│   ┌──────────────┐              ┌──────────────┐               │
│   │  RWA Perps   │              │ RWA Lending  │               │
│   │  (Futures)   │              │  (Borrow)    │               │
│   └──────────────┘              └──────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Contract Dependencies:**

- `rwa-token` → imports `rwa-oracle` WASM
- `rwa-lending` → depends on both `rwa-oracle` and `rwa-token`
- `rwa-perps` → uses `rwa-oracle` for mark prices

### Frontend Architecture

The frontend follows a **feature-based architecture**:

```
Feature Components → Feature Hooks → Services/Helpers → Contract Clients (@neko/*) → Smart Contracts
```

**State Management:**

- **Global state**: Zustand stores (user, wallet, session)
- **Server state**: TanStack Query for async data

**Provider Chain:**

```
QueryClientProvider → WagmiProvider → RainbowKitProvider → WalletProvider → NotificationProvider
```

Each feature module contains:

- `components/` - Feature-specific React components
- `hooks/` - Feature-specific hooks
- `utils/` - Feature-specific utilities

## Deployment

### Contract Deployment

1. Publish your contracts to the registry:

   ```bash
   stellar registry publish
   ```

2. Deploy contract instances:

   ```bash
   stellar registry deploy \\
   --deployed-name my-contract \\
   --published-name my-contract \\
   -- \\
   --param1 value1
   ```

3. Create local aliases:
   ```bash
   stellar registry create-alias my-contract
   ```

### Frontend Deployment

Build the frontend for production:

```bash
npm run build
```

This will build the Next.js app. Deploy the contents of `apps/web-app/.next` directory to your hosting platform of choice (Vercel, Netlify, AWS, etc.).

**Recommended**: Deploy to [Vercel](https://vercel.com/) for optimal Next.js support.

## Environment Configuration

The project uses environment variables with the `NEXT_PUBLIC_` prefix for client-side access.

Create `apps/web-app/.env.local`:

```env
# Stellar Network Configuration
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# SoroSwap ApiKey
NEXT_PUBLIC_SOROSWAP_API_KEY=your_api_key_here
```

Available networks:

- **TESTNET**: Stellar testnet (default for development)
- **FUTURENET**: Stellar futurenet
- **PUBLIC**: Stellar mainnet (production)
- **LOCAL**: Local Stellar network for development

## Key Components

### DeFi Features

- **Swap**: Token exchange interface using CoW Swap SDK
- **Lend**: Supply assets to lending pools
- **Borrow**: Borrow against collateral
- **Pools**: Manage liquidity positions
- **Oracle**: Real-time price feeds for RWA tokens

### Contract Packages

The `packages/contracts/` directory contains TypeScript clients for smart contracts:

- `@neko/oracle` - Oracle contract client
- `@neko/lending` - Lending contract client

These packages are automatically linked via npm workspaces.

## Development

### Adding a New Feature

1. Create a new directory in `apps/web-app/src/features/`
2. Add feature-specific components, hooks, and utilities
3. Create a route in `apps/web-app/src/app/dashboard/` if needed
4. Update navigation in `apps/web-app/src/components/navigation/Navbar.tsx`

### Adding a New Contract Package

1. Create a new directory in `packages/contracts/`
2. Add `package.json` with name `@neko/your-contract`
3. Create TypeScript bindings in `src/index.ts`
4. Build with `npm run build` from root

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code:

- Passes all linting checks (`npm run lint`)
- Is formatted with Prettier (`npm run format`)
- Includes appropriate TypeScript types
- Follows the existing code style
- Uses conventional commits (feat, fix, chore, etc.)

### AI Agent Skills

The `.agents/skills/` directory contains specialized skills for Claude Code and other LLM-based assistants. The `.claude/skills` symbolic link provides integration with Claude Code.

| Skill                           | Description                                                                  | Command                        |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------ |
| **stellar-dev**                 | Stellar/Soroban development: contracts, SDK, RPC, wallets, testing, security | `/stellar-dev`                 |
| **tanstack-query**              | TanStack Query v5: patterns, v4→v5 migration, SSR, optimistic updates        | `/tanstack-query`              |
| **tailwind-patterns**           | Tailwind CSS: layouts, cards, navigation, forms, dark mode                   | `/tailwind-patterns`           |
| **next-best-practices**         | Next.js: RSC, data patterns, metadata, error handling, bundling              | `/next-best-practices`         |
| **vercel-react-best-practices** | React performance: rendering, caching, bundle optimization                   | `/vercel-react-best-practices` |
| **vercel-composition-patterns** | React composition: compound components, render props, context                | `/vercel-composition-patterns` |
| **remotion-best-practices**     | Remotion video: animations, transitions, audio, captions                     | `/remotion-best-practices`     |
| **commit-work**                 | Git commits: staging, splitting, Conventional Commits                        | `/commit-work`                 |
| **seo-audit**                   | SEO audit: meta tags, structured data, performance                           | `/seo-audit`                   |
| **web-design-guidelines**       | UI/UX review: accessibility, design best practices                           | `/web-design-guidelines`       |
| **agent-md-refactor**           | Refactor AGENTS.md/CLAUDE.md with progressive disclosure                     | `/agent-md-refactor`           |
| **skill-creator**               | Guide for creating custom skills                                             | `/skill-creator`               |
| **find-skills**                 | Discover and install skills from [skills.sh](https://skills.sh/)             | `/find-skills`                 |

**Installing new skills:**

```bash
npx skills find [query]              # Search for skills
npx skills add <owner/repo@skill>    # Install a skill
npx skills check                     # Check for updates
```

## License

This project is licensed under the MIT License.

## Links

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://developers.stellar.org/docs/build/smart-contracts)
- [Next.js Documentation](https://nextjs.org/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)

## Support

For questions and support, please open an issue on [GitHub](https://github.com/Neko-Protocol/Neko-DApp/issues).

---

<p align="center">
  Built with ❤️ by the <a href="https://github.com/Neko-Protocol">Neko Protocol</a> team
</p>
