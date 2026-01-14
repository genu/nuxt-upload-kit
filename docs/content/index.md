---
seo:
  title: File Uploads for Nuxt Apps
  description: A powerful, plugin-based file upload manager for Nuxt applications with validation, image compression, thumbnail generation, and cloud storage.
---

## ::u-page-hero

## orientation: horizontal

#title
Powerful File Uploads for your [Nuxt Apps]{.text-primary}

#description
A composable-first file upload manager with built-in validation, image compression, thumbnail generation, and cloud storage support. Production-ready in minutes.

#links
:::u-button

---

icon: i-lucide-rocket
size: xl
to: /get-started/installation

---

Get Started
:::

:::copy-code-input{source="npx nuxi module add nuxt-upload-kit"}
:::
::

::u-page-section
#title
Everything you need for [file uploads]{.text-primary}

#features
:::u-page-card

---

spotlight: true
icon: i-lucide-puzzle
to: /plugins/overview

---

#title
Plugin Architecture

#description
Extensible plugin system for validation, processing, and storage. Add only what you need, create custom plugins with ease.
:::

:::u-page-card

---

spotlight: true
icon: i-lucide-cloud-upload
to: /plugins/storage

---

#title
Cloud Storage

#description
Azure Data Lake Storage built-in. Upload directly to the cloud with SAS token authentication and automatic retry logic.
:::

:::u-page-card

---

spotlight: true
icon: i-lucide-image
to: /plugins/image-compressor

---

#title
Image Compression

#description
Compress images in the browser before upload. Reduce file sizes by up to 80% while maintaining visual quality.
:::

:::u-page-card

---

spotlight: true
icon: i-lucide-film
to: /plugins/video-compressor

---

#title
Video Compression

#description
FFmpeg-powered video transcoding in the browser. Resize, re-encode, and optimize videos before they hit your server.
:::

:::u-page-card

---

spotlight: true
icon: i-lucide-shield-check
to: /plugins/validators

---

#title
Built-in Validation

#description
Validate file type, size, count, and duplicates out of the box. Configurable limits with clear error messages.
:::

:::u-page-card

---

spotlight: true
icon: i-lucide-activity
to: /usage/events

---

#title
Event System

#description
Real-time progress tracking with a comprehensive event system. Hook into every stage of the upload lifecycle.
:::
::

## ::u-page-section

## orientation: horizontal

#title
Simple, [composable-first]{.text-primary} API

#description
Get up and running with just a few lines of code. The `useUploadKit` composable handles file state, validation, processing, and uploads — all reactively.

#default

```vue
<script setup lang="ts">
const uploader = useUploadKit({
  maxFiles: 10,
  maxFileSize: 50 * 1024 * 1024,
  allowedFileTypes: ["image/*", "video/*"],
  thumbnails: true,
  imageCompression: { quality: 0.85 },
})

uploader.onUpload(async (file, onProgress) => {
  // Your upload logic here
  const response = await uploadToServer(file, onProgress)
  return response
})
</script>

<template>
  <input type="file" multiple @change="(e) => uploader.addFiles(e.target.files)" />

  <div v-for="file in uploader.files" :key="file.id">
    <img v-if="file.preview" :src="file.preview" />
    <span>{{ file.name }}</span>
    <progress :value="file.progress.percentage" max="100" />
  </div>

  <button @click="uploader.upload()">Upload</button>
</template>
```

#links
:::u-button

---

icon: i-lucide-book-open
size: xl
to: /usage/use-upload-manager

---

Read the docs
:::
::

::u-page-section
#title
Works with your [favorite cloud providers]{.text-primary}

#description
Built-in storage plugins handle authentication, chunked uploads, and error handling. Focus on your app, not infrastructure.

#features
:::u-page-card

---

spotlight: true
icon: i-simple-icons-microsoftazure
to: /plugins/storage/azure-datalake

---

#title
Azure Data Lake

#description
Upload to Azure Data Lake Storage Gen2 with SAS token authentication, automatic retries, and progress tracking.
:::

:::u-page-card

---

spotlight: true
icon: i-simple-icons-amazons3

---

#title
Amazon S3

#description
Coming soon — direct uploads to S3 with presigned URLs and multipart upload support.
:::

:::u-page-card

---

spotlight: true
icon: i-simple-icons-cloudinary

---

#title
Cloudinary

#description
Coming soon — upload and transform images with Cloudinary's powerful media API.
:::
::

## ::u-page-section

orientation: horizontal
reverse: true

---

#title
Extend with [custom plugins]{.text-primary}

#description
The plugin system lets you hook into validation, preprocessing, processing, and upload stages. Create reusable plugins for your specific needs.

#default

```ts
import { definePlugin } from "nuxt-upload-kit"

export const MyCustomPlugin = definePlugin((options) => ({
  name: "my-custom-plugin",

  hooks: {
    // Validate before adding
    "file:validate": async (file, context) => {
      if (file.name.includes("secret")) {
        return { valid: false, error: "No secrets allowed!" }
      }
      return { valid: true }
    },

    // Transform before upload
    "file:process": async (file, context) => {
      const processed = await transformFile(file)
      return processed
    },
  },
}))
```

#links
:::u-button

---

icon: i-lucide-code
size: xl
to: /advanced/custom-plugins

---

Build a plugin
:::
::
