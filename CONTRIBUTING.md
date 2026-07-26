# Contributing to Neko DApp

Thank you for your interest in contributing to Neko! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Code Contributions](#code-contributions)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Commit Message Conventions](#commit-message-conventions)
- [Project Structure](#project-structure)
- [Getting Help](#getting-help)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

Before you begin:

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Neko-DApp.git
   cd Neko-DApp
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/Neko-Protocol/Neko-DApp.git
   ```

## Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v10.2.3 or higher)
- **Rust** (v1.70 or higher) - for smart contract development
- **Stellar CLI** (v23.1.0 or higher) - for contract bindings

See the [README.md](./README.md) for detailed installation instructions.

### Initial Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build contract packages**:
   ```bash
   npm run build
   ```

3. **Set up environment variables**:
   Create `apps/web-app/.env.local` with the required configuration (see [README.md](./README.md#environment-configuration))

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue using the [Bug Report template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- A clear description of the bug
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots or logs (if applicable)
- Environment details (OS, browser, version)

### Solving an issue

If you get assigned an issue, use the [Pull Request template](.github/ISSUE_TEMPLATE/pull_request_template.md) with:

- A clear description of the changes
- Evidence of said changes
- Any examples or comments

### Code Contributions

1. **Choose an issue** to work on.
2. **Get assigned the issue** and start working.
3. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
4. **Make your changes** following our [code style guidelines](#code-style-guidelines)
5. **Test your changes** thoroughly
6. **Commit your changes** using [conventional commits](#commit-message-conventions)
7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request** (see [Pull Request Process](#pull-request-process))

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `chore/` - Maintenance tasks

### Keeping Your Branch Updated

Regularly sync your branch with the upstream repository:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git checkout your-branch
git merge main
```

## Code Style Guidelines

### TypeScript/JavaScript

- **Use TypeScript** for all new code
- **Follow existing code patterns** and conventions
- **Use meaningful variable and function names**
- **Keep functions focused** and single-purpose
- **Avoid deep nesting** - prefer early returns

### Formatting

- **Run Prettier** before committing:
  ```bash
  npm run format
  ```
- Prettier will automatically format staged files via Husky pre-commit hook
- **Check formatting**:
  ```bash
  npm run format:check
  ```

### Linting

- **Run ESLint** before committing:
  ```bash
  npm run lint
  ```
- Fix all linting errors before submitting a PR

### React/Next.js

- **Use functional components** with hooks
- **Follow the feature-based architecture** (see [Project Structure](#project-structure))
- **Use TypeScript interfaces** for props and state
- **Keep components small and focused**
- **Use custom hooks** for reusable logic

### Rust (Smart Contracts)

- **Follow Rust naming conventions** (snake_case for functions/variables)
- **Add documentation comments** (`///`) for public items
- **Use meaningful error types**
- **Write tests** for contract functions

### File Organization

- **Place feature-specific code** in `apps/web-app/src/features/[feature-name]/`
- **Use shared components** from `apps/web-app/src/components/`
- **Add utilities** to `apps/web-app/src/lib/helpers/`
- **Keep constants** in `apps/web-app/src/lib/constants/`

## Testing

### Frontend Testing

- **Test your changes** in the development environment
- **Verify functionality** across different browsers (Chrome, Firefox, Safari)
- **Test responsive design** on different screen sizes
- **Check wallet integration** works correctly

### Smart Contract Testing

- **Write unit tests** for contract functions
- **Test edge cases** and error conditions
- **Verify contract interactions** work as expected

### Before Submitting

- Ensure all existing tests pass
- Test your changes thoroughly
- Verify no console errors or warnings

## Pull Request Process

### PR Checklist

Before submitting a PR, ensure:

- [ ] Your code follows the [code style guidelines](#code-style-guidelines)
- [ ] All linting checks pass (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] TypeScript types are properly defined
- [ ] Your branch is up to date with `main`
- [ ] You've tested your changes
- [ ] You've added/updated documentation if needed

### PR Template

When opening a PR, fill out the [Pull Request template](.github/ISSUE_TEMPLATE/pull_request_template.md) completely:

- **Type of Change**: Mark the appropriate checkbox
- **Changes Description**: Clearly describe what you changed and why
- **Evidence**: **REQUIRED** - Include a Loom/Cap video or screenshots demonstrating your changes
- **Time Spent Breakdown**: Estimate time spent on different parts
- **Comments**: Any additional notes or context

### PR Requirements

- **Evidence is mandatory** - PRs without evidence will not be merged
- **Link to related issues** if applicable
- **Keep PRs focused** - one feature or fix per PR
- **Keep PRs reasonably sized** - break large changes into smaller PRs when possible

### Review Process

1. **Automated checks** will run (linting, formatting, etc.)
2. **Maintainers will review** your code
3. **Address feedback** by pushing new commits to your branch
4. **Once approved**, your PR will be merged

### Continuous Integration (CI)

Every pull request (and every push to `dev`) triggers the **CI** workflow
(`.github/workflows/ci.yml`), which runs on GitHub Actions:

- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production build
- `npm run test` — Vitest suite

If any step fails, the PR is marked with a red ❌ and **should not be
merged** until it is green. You can reproduce the exact checks locally with:

```bash
npm run lint && npm run typecheck && npm run build && npm run test
```

> **Maintainers:** mark the `CI / Lint · Typecheck · Build · Test` check as a
> required status check under **Settings → Branches → Branch protection**
> for `dev` (and `main`) so failing PRs are blocked from merging.

## Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Maintenance tasks (dependencies, config, etc.)
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```
feat(lending): add collateral ratio calculation

Implement dynamic collateral ratio based on asset type and market conditions.

Closes #123
```

```
fix(swap): resolve token balance display issue

The balance was not updating after successful swaps. Fixed by adding proper state updates.

Fixes #456
```

```
docs: update contributing guide

Add section on commit message conventions.
```

## Project Structure

This is a monorepo managed with Turborepo. Key directories:

```
neko-dapp/
├── apps/
│   ├── web-app/              # Next.js frontend application
│   │   └── src/
│   │       ├── app/          # Next.js App Router pages
│   │       ├── features/     # Feature-based modules
│   │       ├── components/   # Shared UI components
│   │       ├── hooks/        # Custom React hooks
│   │       ├── lib/          # Utilities and helpers
│   │       └── providers/    # Context providers
│   └── contracts/
│       └── stellar-contracts/ # Rust smart contracts
└── packages/
    ├── config/               # Shared configuration
    └── contracts/            # Contract client packages
```

### Adding a New Feature

1. Create a new directory in `apps/web-app/src/features/[feature-name]/`
2. Add feature-specific components, hooks, and utilities
3. Create a route in `apps/web-app/src/app/dashboard/` if needed
4. Update navigation in `apps/web-app/src/components/navigation/Navbar.tsx`

### Adding a New Contract Package

1. Create a new directory in `packages/contracts/`
2. Add `package.json` with name `@neko/your-contract`
3. Create TypeScript bindings in `src/index.ts`
4. Build with `npm run build` from root

## Getting Help

- **Documentation**: Check the [README.md](./README.md) for setup and usage
- **Issues**: Search existing [GitHub Issues](https://github.com/Neko-Protocol/Neko-DApp/issues)
- **Discussions**: Open a discussion for questions or ideas
- **Contact**: Reach out to the team through GitHub

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://developers.stellar.org/docs/build/smart-contracts)
- [Next.js Documentation](https://nextjs.org/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

Thank you for contributing to Neko DApp! Your efforts help make RWAs consumer-friendly on Stellar. 🚀
