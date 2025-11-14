# Contributing to Rexpo Network Inspector

First off, thank you for considering contributing to Rexpo Network Inspector! It's people like you that make this tool better for everyone.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what behavior you expected
- **Include screenshots or GIFs** if possible
- **Include your environment details**: OS, Node version, Expo SDK version

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful** to most users
- **List any similar features** in other tools if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following our coding standards
4. **Test your changes**: Ensure the app runs with `npm run dev`
5. **Build the project**: Run `npm run build` to verify everything compiles
6. **Update documentation** if needed
7. **Commit your changes** using clear commit messages
8. **Push to your fork** and submit a pull request

## Development Setup

### Prerequisites

- Node.js >= 14.0.0
- npm or yarn

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rexpo-debugger.git
cd rexpo-debugger

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
rexpo-debugger/
├── electron/          # Electron main process
├── renderer/          # React UI components
├── expo-agent/        # NPM package for Expo/RN apps
└── docs/             # Documentation
```

### Testing the Agent

```bash
cd expo-agent
npm install
npm run build

# Test in your Expo project
npm link
cd your-expo-project
npm link rexpo-debugger
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Avoid `any` type when possible
- Add JSDoc comments for public APIs

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Keep lines under 100 characters when reasonable

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add request replay functionality
fix: resolve WebSocket connection timeout
docs: update installation instructions
refactor: simplify request filtering logic
test: add unit tests for curlGenerator
chore: update dependencies
```

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring

## Review Process

1. **Automated checks** must pass (type checking, builds)
2. **Code review** by maintainers
3. **Testing** by reviewers when applicable
4. **Merge** after approval

## Questions?

Feel free to:

- Open an issue for discussion
- Email: omeremreelma@gmail.com
- Check existing documentation in `/docs`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for your contribution! 🎉**
