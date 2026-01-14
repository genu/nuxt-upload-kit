<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

const nav = computed(() => ([
  {
    title: 'Documentation',
    icon: 'i-lucide-book-open',
    path: '/get-started/installation',
    children: navigation!.value,
  },
  {
    title: 'Releases',
    icon: 'i-lucide-rocket',
    path: 'https://github.com/genu/nuxt-upload-kit/releases',
    target: '_blank',
  },
]))
</script>

<template>
  <UContentNavigation
    highlight
    variant="link"
    :navigation="nav"
  />
</template>
