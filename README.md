<p align="center">
  <img src="docs/public/logo.png" alt="Nuxt Upload Kit" width="300" />
</p>

<h1 align="center">Nuxt Upload Kit</h1>

<p align="center">A powerful, plugin-based file upload manager for Nuxt applications.</p>

## Features

- 🔌 **Plugin System** - Extensible architecture with built-in plugins for validation, compression, and storage
- 📤 **Multi-provider Storage** - Azure Data Lake support with S3, Cloudinary coming soon
- 🖼️ **Image Processing** - Automatic thumbnail generation and image compression
- 🎥 **Video Compression** - FFmpeg-powered video compression (optional)
- ✅ **Validation** - File type, size, and count validation out of the box
- 📊 **Progress Tracking** - Real-time upload progress with events
- 🔄 **File Lifecycle** - Complete control over file preprocessing, processing, and post-upload

## Installation

```bash
pnpm add nuxt-upload-kit
# or
npm install nuxt-upload-kit
# or
yarn add nuxt-upload-kit
```

## Setup

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ["nuxt-upload-kit"],
})
```

## Quick Start

```vue
<script setup lang="ts">
const uploader = useUploadKit({
  maxFiles: 10,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedFileTypes: ["image/jpeg", "image/png", "video/mp4"],
  thumbnails: true,
  imageCompression: {
    maxWidth: 1920,
    quality: 0.85,
  },
})

// Configure upload handler
uploader.onUpload(async (file, onProgress) => {
  const formData = new FormData()
  formData.append("file", file.data as Blob)

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  })

  return await response.json()
})

// Add files
const onFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    await uploader.addFiles(Array.from(input.files))
  }
}

// Upload all files
const handleUpload = () => uploader.upload()
</script>

<template>
  <div>
    <input type="file" multiple @change="onFileSelect" />

    <div v-for="file in uploader.files" :key="file.id">
      <img v-if="file.preview" :src="file.preview" />
      <span>{{ file.name }} - {{ file.status }}</span>
      <progress :value="file.progress.percentage" max="100" />
    </div>

    <button @click="handleUpload">Upload</button>
  </div>
</template>
```

## Using Storage Plugins

### Azure Data Lake Storage

```typescript
import { PluginAzureDataLake } from "nuxt-upload-kit"

const uploader = useUploadKit({
  storage: PluginAzureDataLake({
    sasURL: "https://your-storage.blob.core.windows.net/container?sv=...",
    path: "uploads/images",
  }),
  thumbnails: true,
})
```

## Configuration Options

| Option             | Type                            | Default | Description                     |
| ------------------ | ------------------------------- | ------- | ------------------------------- |
| `storage`          | `StoragePlugin`                 | -       | Storage plugin for file uploads |
| `plugins`          | `ProcessingPlugin[]`            | `[]`    | Additional processing plugins   |
| `maxFiles`         | `number \| false`               | `false` | Maximum number of files         |
| `maxFileSize`      | `number \| false`               | `false` | Maximum file size in bytes      |
| `allowedFileTypes` | `string[] \| false`             | `false` | Allowed MIME types              |
| `thumbnails`       | `boolean \| ThumbnailOptions`   | `false` | Enable thumbnail generation     |
| `imageCompression` | `boolean \| CompressionOptions` | `false` | Enable image compression        |
| `autoUpload`      | `boolean`                       | `false` | Auto-upload after adding files  |

## Events

```typescript
uploader.on("file:added", (file) => console.log("Added:", file.name))
uploader.on("file:removed", (file) => console.log("Removed:", file.name))
uploader.on("file:error", ({ file, error }) => console.error(error))
uploader.on("upload:start", (files) => console.log("Starting upload"))
uploader.on("upload:progress", ({ file, progress }) => console.log(progress))
uploader.on("upload:complete", (files) => console.log("Complete!"))
```

## Creating Custom Plugins

```typescript
import { defineProcessingPlugin } from "nuxt-upload-kit"

const MyPlugin = defineProcessingPlugin<{ option: string }>((options) => ({
  id: "my-plugin",
  hooks: {
    validate: async (file, context) => {
      // Validation logic
      return file
    },
    process: async (file, context) => {
      // Processing logic
      context.emit("processed", { file })
      return file
    },
  },
}))
```

## Optional Dependencies

For video compression, install FFmpeg:

```bash
pnpm add @ffmpeg/ffmpeg @ffmpeg/util
```

For Azure storage, install the Azure SDK:

```bash
pnpm add @azure/storage-file-datalake
```

## License

MIT
