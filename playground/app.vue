<script setup lang="ts">
const uploader = useUploadManager({
  maxFiles: 5,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  thumbnails: true,
  imageCompression: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
  },
})

// Handle file selection
const onFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    await uploader.addFiles(Array.from(input.files))
  }
}

// Configure custom upload handler (for demo purposes, just logs)
uploader.onUpload(async (file, onProgress) => {
  console.log("Uploading:", file.name)

  // Simulate upload progress
  for (let i = 0; i <= 100; i += 10) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    onProgress(i)
  }

  return { url: `https://example.com/uploads/${file.id}` }
})

// Listen to events
uploader.on("file:added", (file) => {
  console.log("File added:", file.name)
})

uploader.on("upload:complete", (files) => {
  console.log("Upload complete:", files.length, "files")
})
</script>

<template>
  <div class="p-8 max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">Nuxt Upload Kit Playground</h1>

    <div class="mb-6">
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        @change="onFileSelect"
      />
    </div>

    <div v-if="uploader.files.length > 0" class="space-y-4">
      <h2 class="text-lg font-semibold">Files ({{ uploader.files.length }})</h2>

      <div v-for="file in uploader.files" :key="file.id" class="flex items-center gap-4 p-4 border rounded-lg">
        <img
          v-if="file.preview && file.mimeType.startsWith('image/')"
          :src="file.preview"
          class="w-16 h-16 object-cover rounded"
        />
        <div v-else class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
          {{ file.mimeType.split("/")[1] }}
        </div>

        <div class="flex-1">
          <p class="font-medium">{{ file.name }}</p>
          <p class="text-sm text-gray-500">{{ (file.size / 1024).toFixed(2) }} KB</p>
          <p class="text-xs text-gray-400">Status: {{ file.status }}</p>
          <div v-if="file.status === 'uploading'" class="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all" :style="{ width: `${file.progress.percentage}%` }"></div>
          </div>
        </div>

        <button class="text-red-500 hover:text-red-700" @click="uploader.removeFile(file.id)">Remove</button>
      </div>

      <div class="flex gap-4">
        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" @click="uploader.upload()">Upload All</button>
        <button class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300" @click="uploader.clearFiles()">
          Clear All
        </button>
      </div>

      <div class="text-sm text-gray-500">Total Progress: {{ uploader.totalProgress }}%</div>
    </div>

    <div v-else class="text-gray-500 text-center py-8">No files selected. Choose files to upload.</div>
  </div>
</template>
