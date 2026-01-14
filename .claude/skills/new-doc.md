# Create Documentation Page

Create a new documentation page for nuxt-upload-kit.

## Instructions

1. Ask the user what they want to document if not clear from context

2. Create the markdown file in `docs/content/` with appropriate numbering:
   - `1.get-started/` - Installation, setup, quickstart
   - `2.usage/` - API reference, composables, events
   - `3.plugins/` - Plugin documentation
   - `4.advanced/` - Custom plugins, architecture

3. Use Docus MDC component syntax:

   ```markdown
   ::prose-tip
   Helpful information
   ::

   ::prose-note
   Important warning
   ::

   ## ::u-page-card

   icon: i-lucide-icon-name
   to: /link

   ---

   #title
   Card Title

   #description
   Card description
   ::
   ```

4. Include frontmatter:

   ```yaml
   ---
   title: Page Title
   description: Brief description for SEO
   navigation:
     icon: i-lucide-icon-name
   ---
   ```

5. Follow existing documentation patterns - check similar pages for reference

6. Use code blocks with language hints: `ts, `vue, ```bash [Terminal]
