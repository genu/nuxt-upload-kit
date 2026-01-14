<p align="center">
  <img src="docs/public/logo.png" alt="Nuxt Upload Kit" width="300" />
</p>

<h1 align="center">Nuxt Upload Kit</h1>

<p align="center">A powerful, plugin-based file upload manager for Nuxt applications.</p>

> [!WARNING]
> This module is experimental and under active development. The API may change between versions without notice. Use in production at your own risk.

## Features

- 🔌 **Plugin System** - Extensible architecture with built-in plugins for validation, compression, and storage
- 📤 **Multi-provider Storage** - Azure Data Lake support with S3, Cloudinary coming soon
- 🖼️ **Image Processing** - Automatic thumbnail generation and image compression
- 🎥 **Video Compression** - FFmpeg-powered video compression (optional)
- ✅ **Validation** - File type, size, and count validation out of the box
- 📊 **Progress Tracking** - Real-time upload progress with events

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

## Documentation

For full documentation, visit [nuxt-upload-kit.vercel.app](https://nuxt-upload-kit.vercel.app)

## License

MIT
