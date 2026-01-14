---
title: Storage Plugins
description: Overview of storage plugins for uploading files to cloud providers.
---

# Storage Plugins

Storage plugins handle uploading, downloading, and deleting files from remote storage providers.

## Available Providers

| Provider             | Plugin                | Status      |
| -------------------- | --------------------- | ----------- |
| Azure Data Lake      | `PluginAzureDataLake` | Available   |
| Amazon S3            | -                     | Coming soon |
| Google Cloud Storage | -                     | Coming soon |
| Cloudinary           | -                     | Coming soon |

## Using Storage Plugins

Configure a storage plugin using the `storage` option:

```ts
import { PluginAzureDataLake } from "nuxt-upload-kit"

const uploader = useUploadKit({
  storage: PluginAzureDataLake({
    sasURL: "https://...",
    path: "uploads",
  }),
})
```

::prose-tip
Only one storage plugin can be active at a time. The `storage` option takes precedence over any storage plugins in the `plugins` array.
::

## Without Storage Plugins

If you don't use a storage plugin, implement upload logic with `onUpload`:

```ts
const uploader = useUploadKit()

uploader.onUpload(async (file, onProgress) => {
  const formData = new FormData()
  formData.append("file", file.data as Blob)

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.response))
      } else {
        reject(new Error("Upload failed"))
      }
    }

    xhr.onerror = () => reject(new Error("Network error"))
    xhr.open("POST", "/api/upload")
    xhr.send(formData)
  })
})
```

## Storage Plugin Interface

All storage plugins implement the following hooks:

```ts
interface StoragePluginHooks {
  // Required: Upload a file
  upload: (file, context) => Promise<{ url: string; ... }>

  // Optional: Get remote file metadata
  getRemoteFile?: (fileId, context) => Promise<{
    size: number
    mimeType: string
    remoteUrl: string
    preview?: string
  }>

  // Optional: Delete a file
  remove?: (file, context) => Promise<void>
}
```

## Creating Custom Storage Plugins

See the [Custom Plugins](/advanced/custom-plugins#storage-plugins) guide for creating your own storage plugin.
