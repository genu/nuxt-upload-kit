<script setup lang="ts">
const links = [
  {
    label: "Documentation",
    to: "/get-started/installation",
  },
  {
    label: "Releases",
    to: "https://github.com/genu/nuxt-upload-kit/releases",
    target: "_blank",
  },
]
</script>

<template>
  <UNavigationMenu :items="links" variant="link" />
</template>
