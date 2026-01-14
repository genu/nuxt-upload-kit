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
    └── composables/
        ├── useUploadKit/    # Main composable
        │   ├── index.ts         # Core upload manager logic
        │   ├── types.ts         # Type definitions
        │   ├── validators/      # Validation plugins (max-files, file-types, etc.)
        │   └── plugins/         # Processing plugins
        │       ├── thumbnail-generator.ts
        │       ├── image-compressor.ts
        │       ├── video-compressor.ts
        │       └── storage/
        │           └── azure-datalake.ts
        └── useFFMpeg.ts         # FFmpeg composable for video processing
```

**Key Concepts:**

- **Storage Plugins**: Handle file persistence (Azure Data Lake implemented)
- **Processing Plugins**: Transform files (thumbnails, compression)
- **Validator Plugins**: Validate files before adding (type, size, count)
- **Event System**: Uses `mitt` with `subject:action` naming (e.g., `file:added`, `upload:complete`)

## Code Style

- No semicolons
- Double quotes
- Trailing commas
- 130 character line width
- TypeScript throughout

## Creating New Plugins

**Validator Plugin Pattern:**

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

## Claude Code Skills

Available slash commands for this project:

- `/new-plugin` - Create a new validator, processing, or storage plugin
- `/new-doc` - Create a new documentation page
- `/test` - Run tests with guidance on fixing failures
