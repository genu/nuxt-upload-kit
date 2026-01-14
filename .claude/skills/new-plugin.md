# Create a New Plugin

Create a new plugin for nuxt-upload-kit based on user requirements.

## Instructions

1. Ask the user what type of plugin they want to create:
   - **Validator**: Validates files before adding (e.g., check dimensions, scan content)
   - **Processing**: Transforms files before upload (e.g., watermark, resize)
   - **Storage**: Handles uploading to a cloud provider (e.g., S3, Cloudflare R2)

2. Based on the plugin type, create the file in the appropriate location:
   - Validators: `src/runtime/composables/useUploadKit/validators/`
   - Processing: `src/runtime/composables/useUploadKit/plugins/`
   - Storage: `src/runtime/composables/useUploadKit/plugins/storage/`

3. Follow the existing patterns in the codebase:
   - Use `defineProcessingPlugin` for validators and processing plugins
   - Storage plugins return a `StoragePlugin` object directly
   - Use the event system with `subject:action` naming (e.g., `plugin-name:progress`)

4. Export the new plugin from `src/runtime/composables/useUploadKit/plugins/index.ts`

5. Add documentation in `docs/content/3.plugins/` following the existing format

6. Update the playground to demonstrate the new plugin if appropriate

## Code Style

- No semicolons
- Double quotes
- Trailing commas
- TypeScript with proper types
