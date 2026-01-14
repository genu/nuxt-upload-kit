export default defineAppConfig({
  ui: {
    colors: {
      primary: 'emerald',
      neutral: 'zinc',
    },
    pageHero: {
      slots: {
        links: 'flex flex-wrap items-center gap-4',
      },
    },
  },
  seo: {
    title: 'Nuxt Upload Kit',
    description: 'A powerful, plugin-based file upload manager for Nuxt applications.',
  },
  header: {
    title: 'Nuxt Upload Kit',
  },
  socials: {
    github: 'https://github.com/genu/nuxt-upload-kit',
    x: 'https://x.com/nicholasgeorge',
  },
  github: {
    url: 'https://github.com/genu/nuxt-upload-kit',
    branch: 'main',
    rootDir: 'docs/content',
  },
  toc: {
    title: 'On this page',
    bottom: {
      title: 'Community',
      links: [
        {
          label: 'GitHub Discussions',
          icon: 'i-simple-icons-github',
          to: 'https://github.com/genu/nuxt-upload-kit/discussions',
          target: '_blank',
        },
        {
          label: 'Report Issues',
          icon: 'i-lucide-bug',
          to: 'https://github.com/genu/nuxt-upload-kit/issues',
          target: '_blank',
        },
      ],
    },
  },
})
