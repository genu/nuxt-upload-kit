<script setup lang="ts">
import type { ContentNavigationItem } from "@nuxt/content"

const navigation = inject<Ref<ContentNavigationItem[]>>("navigation")

const links = [
  {
    label: "Documentation",
    to: "/get-started/overview",
  },
  {
    label: "Releases",
    to: "/releases",
  },
]

const nav = computed(() => [
  {
    title: "Documentation",
    icon: "i-lucide-book-open",
    path: "/get-started/overview",
    children: navigation!.value,
  },
  {
    title: "Releases",
    icon: "i-lucide-rocket",
    path: "/releases",
  },
])
</script>

<template>
  <UHeader>
    <template #title>
      <div class="flex items-center gap-2">
        <img src="/logo.png" alt="Nuxt Upload Kit" class="h-7 w-auto dark:hidden" />
        <img src="/logo-dark.png" alt="Nuxt Upload Kit" class="h-7 w-auto hidden dark:block" />
        <span class="font-semibold text-highlighted">Nuxt Upload Kit</span>
      </div>
    </template>

    <template #default>
      <UNavigationMenu :items="links" variant="link" />
    </template>

    <template #right>
      <UColorModeButton />
      <UButton
        to="https://github.com/genu/nuxt-upload-kit"
        target="_blank"
        icon="i-simple-icons-github"
        color="neutral"
        variant="ghost"
      />
    </template>

    <template #body>
      <UContentNavigation highlight variant="link" :navigation="nav" />
    </template>
  </UHeader>
</template>
