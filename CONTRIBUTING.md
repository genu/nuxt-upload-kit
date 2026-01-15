# Contributing to Nuxt Upload Kit

Thank you for your interest in contributing to Nuxt Upload Kit! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) 18.x or 20.x (LTS recommended)
- [pnpm](https://pnpm.io/) 10.x or later

## Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/nuxt-upload-kit.git
   cd nuxt-upload-kit
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Prepare the development environment**

   ```bash
   pnpm dev:prepare
   ```

4. **Start the development server**

   ```bash
   pnpm dev
   ```

   This starts a playground application where you can test your changes.

## Project Structure

```
nuxt-upload-kit/
├── src/
│   ├── module.ts                    # Nuxt module entry point
│   └── runtime/
│       ├── types/index.ts           # Exported types
│       └── composables/
│           ├── useUploadKit/        # Main composable
│           │   ├── index.ts         # Core upload manager
│           │   ├── types.ts         # Type definitions
│           │   ├── validators/      # Validation plugins
│           │   └── plugins/         # Processing plugins
│           │       └── storage/     # Storage adapters
│           └── useFFMpeg.ts         # FFmpeg composable
├── playground/                      # Development playground
├── docs/                            # Documentation site
└── test/                            # Test files
```

## Available Scripts

| Command           | Description                            |
| ----------------- | -------------------------------------- |
| `pnpm dev`        | Start dev server with playground       |
| `pnpm dev:prepare`| Prepare development environment        |
| `pnpm test`       | Run tests once                         |
| `pnpm test:watch` | Run tests in watch mode                |
| `pnpm test:types` | Type-check with vue-tsc                |
| `pnpm lint`       | Run ESLint                             |
| `pnpm lint:fix`   | Fix ESLint issues                      |
| `pnpm format`     | Format with Prettier                   |
| `pnpm docs:dev`   | Run documentation site locally         |
| `pnpm prepack`    | Build the module                       |

## Code Style

This project uses ESLint and Prettier for code formatting:

- No semicolons
- Double quotes
- Trailing commas
- 130 character line width
- TypeScript throughout

Run `pnpm lint:fix` and `pnpm format` before committing to ensure your code matches the project style.

## Making Changes

### Creating a Branch

Create a descriptive branch for your changes:

```bash
git checkout -b feature/my-new-feature
# or
git checkout -b fix/issue-description
```

### Writing Tests

Tests are located in the `test/` directory and use Vitest. Run tests with:

```bash
pnpm test        # Run once
pnpm test:watch  # Watch mode
```

Please include tests for any new features or bug fixes.

### Type Checking

Ensure your changes pass type checking:

```bash
pnpm test:types
```

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add new storage adapter for S3`
- `fix: resolve thumbnail generation for large images`
- `docs: update configuration guide`
- `refactor: simplify plugin registration`
- `test: add tests for video compression`

## Creating Plugins

### Validator Plugin

```typescript
export const ValidatorExample = defineProcessingPlugin<{ option: string }>((options) => ({
  id: "validator-example",
  hooks: {
    validate: async (file, context) => {
      // Return file to pass, throw to reject
      return file
    },
  },
}))
```

### Storage Plugin

```typescript
export const PluginStorageExample = (options: Options): StoragePlugin => ({
  id: "storage-example",
  hooks: {
    upload: async (file, context) => {
      // Upload logic, call context.onProgress(0-100)
      return { url: "...", ...metadata }
    },
    getRemoteFile: async (fileId, context) => {
      return { size, mimeType, remoteUrl }
    },
    remove: async (file, context) => {
      // Delete from storage
    },
  },
})
```

See the [Custom Plugins](https://nuxt-upload-kit.dev/advanced/custom-plugins) documentation for more details.

## Documentation

Documentation lives in the `docs/` directory and uses [Docus](https://docus.dev/).

To run the documentation site locally:

```bash
pnpm docs:dev
```

When adding new features, please update the relevant documentation.

## Submitting a Pull Request

1. Ensure all tests pass: `pnpm test`
2. Ensure code is properly formatted: `pnpm lint:fix && pnpm format`
3. Ensure types are correct: `pnpm test:types`
4. Push your branch and create a pull request
5. Provide a clear description of your changes
6. Link any related issues

## Reporting Issues

When reporting issues, please include:

- Your Node.js version
- Your pnpm version
- Your Nuxt version
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages or logs

## Questions?

If you have questions about contributing, feel free to [open an issue](https://github.com/genu/nuxt-upload-kit/issues) or start a discussion.

## License

By contributing to Nuxt Upload Kit, you agree that your contributions will be licensed under the MIT License.
