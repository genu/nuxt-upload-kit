<script setup lang="ts">
interface GitHubRelease {
  id: number
  tag_name: string
  name: string | null
  body: string | null
  published_at: string
  html_url: string
  author: {
    login: string
    avatar_url: string
    html_url: string
  }
}

// Fetch at build time only (no client-side refetch)
const { data: releases } = await useFetch<GitHubRelease[]>(
  "https://api.github.com/repos/genu/nuxt-upload-kit/releases",
  {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
    getCachedData: (key, nuxtApp) => nuxtApp.static.data[key] ?? nuxtApp.payload.data[key],
  }
)

const versions = computed(() =>
  releases.value?.map((release) => ({
    title: release.name || release.tag_name,
    date: release.published_at,
    badge: release.tag_name,
    to: release.html_url,
    target: "_blank" as const,
    content: release.body || "",
    authors: [
      {
        name: release.author?.login,
        avatar: {
          src: release.author?.avatar_url,
          alt: release.author?.login,
        },
        to: release.author?.html_url,
        target: "_blank" as const,
      },
    ],
  })) || []
)

useSeoMeta({
  title: "Releases - Nuxt Upload Kit",
  description: "All releases and changelog for Nuxt Upload Kit",
})
</script>

<template>
  <UPage>
    <UPageHero
      title="Releases"
      description="All notable changes to Nuxt Upload Kit."
      :ui="{ container: 'lg:py-16' }"
    />

    <UPageBody>
      <UContainer :ui="{ base: 'max-w-3xl' }">
        <UChangelogVersions v-if="versions.length">
          <UChangelogVersion
            v-for="version in versions"
            :key="version.title"
            :title="version.title"
            :date="version.date"
            :badge="version.badge"
            :to="version.to"
            :target="version.target"
            :authors="version.authors"
          >
            <template #body>
              <MDC :value="version.content" />
            </template>
          </UChangelogVersion>
        </UChangelogVersions>

        <UEmpty
          v-else
          icon="i-lucide-git-branch"
          title="No releases yet"
          description="Check back soon for the first release!"
        />
      </UContainer>
    </UPageBody>
  </UPage>
</template>
