# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nuxt Upload Kit is a Nuxt 4 module providing a plugin-based file upload system with multi-provider storage, image/video processing, validation, and progress tracking.

## Commands

```bash
# Development
pnpm dev              # Start dev server with playground
pnpm dev:prepare      # Prepare development environment
pnpm docs:dev         # Run documentation site locally

# Building
pnpm prepack          # Build the module

# Testing
pnpm test             # Run tests once
pnpm test:watch       # Run tests in watch mode
pnpm test:types       # Type-check with vue-tsc

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues
pnpm format           # Format with Prettier
```

## Architecture

```
src/
├── module.ts                    # Nuxt module entry point
└── runtime/
    ├── types/index.ts           # All exported types
    ├── shared/                  # Isomorphic core (rules, restrictions, errors)
    │   ├── rules/               # Pure rule functions (max-file-size, allowed-mime-types, etc.)
    │   ├── restrictions.ts      # Public Restrictions type
    │   └── error.ts             # RestrictionError class
    ├── server/
    │   ├── handlers/            # /presign, /direct, /download, /delete
    │   ├── plugins/bootstrap.ts # Resolves mode + capabilities at server startup
    │   ├── adapters/            # S3, Azure, Firebase storage adapters
    │   ├── capabilities.ts      # deriveCapabilities, resolveMode helpers
    │   └── restrictions.ts      # enforceRestrictions (h3 status mapping)
    └── composables/
        ├── useUploadKit/        # Main composable
        │   ├── index.ts         # Core upload manager logic
        │   ├── types.ts         # Type definitions
        │   └── plugins/         # Processing plugins
        │       ├── thumbnail-generator.ts
        │       ├── image-compressor.ts
        │       ├── video-compressor.ts
        │       └── storage/
        │           └── azure-datalake.ts
        └── useFFMpeg.ts         # FFmpeg composable for video processing
```

**Key Concepts:**

- **Restrictions**: Declarative, JSON-serializable rules (`maxFileSize`, `allowedMimeTypes`, etc.) configured in `nuxt.config.ts > uploadKit.restrictions`. The shared rule core in `runtime/shared/` enforces them identically on the client (composable) and server (h3 handlers).
- **Storage Adapters**: Server-side cloud SDK wrappers (S3, Azure, Firebase). Mode (`presigned` vs `server`) is derived from which methods the adapter implements.
- **Processing Plugins**: Transform files (thumbnails, compression) or implement custom rules that don't fit `Restrictions` (async checks, content inspection).
- **Event System**: Uses `mitt` with `subject:action` naming (e.g., `file:added`, `upload:complete`)

## Code Style

- No semicolons
- Double quotes
- Trailing commas
- 130 character line width
- TypeScript throughout

## Creating New Plugins

For common static rules (size, MIME types, count) — extend `Restrictions` in `src/runtime/shared/restrictions.ts` and add a corresponding rule in `src/runtime/shared/rules/`. Both runtimes pick it up automatically.

**Custom Validator Plugin Pattern** (for rules that can't be expressed declaratively — async checks, stateful rules, content inspection):

```typescript
export const ValidatorExample = defineProcessingPlugin<{ option: string }>((options) => ({
  id: "validator-example",
  hooks: {
    validate: async (file, context) => {
      // Return file to pass, throw { message } to reject
      return file
    },
  },
}))
```

**Storage Plugin Pattern:**

```typescript
export const PluginStorageExample = (options: Options): StoragePlugin => ({
  id: "storage-example",
  hooks: {
    upload: async (file, context) => {
      // Upload logic, call context.onProgress(0-100)
      return { url: "...", ...metadata }
    },
    getRemoteFile: async (fileId, context) => {
      // Fetch existing file metadata
      return { size, mimeType, remoteUrl }
    },
    remove: async (file, context) => {
      // Delete from storage
    },
  },
})
```

## Documentation Site

The `/docs` folder uses Docus (built on Nuxt Content):

- Content files: `docs/content/` (numbered prefixes for ordering)
- Custom components: `docs/app/components/`
- Config: `docs/app.config.ts` (header, socials, theme)
- MDC components: `::component-name` syntax for Vue components in markdown

### Docs deployment

Vercel's production branch is `release`, not `master`. The Release workflow fast-forwards `release` to the published commit after a successful `npm publish`, so prod docs always match the latest published npm version. Master pushes only get Vercel preview deploys per-PR.

## Code Review Guidelines

When reviewing storage adapters or SDK integrations, do NOT recommend:

- **Retry/backoff logic** - These are handled internally by the respective cloud SDKs (Azure, Firebase, AWS, etc.)
- **Token expiry checking** - Also handled internally by SDKs; don't add manual expiry checks unless there's a specific edge case the SDK doesn't cover

Focus reviews on: architecture, race conditions, API design, memory leaks, and actual bugs.

## Claude Code Skills

Available slash commands for this project:

- `/new-plugin` - Create a new validator, processing, or storage plugin
- `/new-doc` - Create a new documentation page
- `/test` - Run tests with guidance on fixing failures
