# Changelog


## [0.2.0](https://github.com/genu/nuxt-upload-kit/compare/v0.1.27...v0.2.0) (2026-04-29)


### ⚠ BREAKING CHANGES

* unify client/server validation via shared restrictions core ([#212](https://github.com/genu/nuxt-upload-kit/issues/212))
* rename initialize/appendExistingFiles to set/addExistingFiles ([#163](https://github.com/genu/nuxt-upload-kit/issues/163))

### Features

* server-side enforcement of aggregate restrictions ([#203](https://github.com/genu/nuxt-upload-kit/issues/203)) ([#213](https://github.com/genu/nuxt-upload-kit/issues/213)) ([5e8bf9a](https://github.com/genu/nuxt-upload-kit/commit/5e8bf9a6fd08f5c46397ec1dedfa2b46b47e8c3b))
* **useUploadKit:** return `ready` promise alongside `isReady` ref (closes [#156](https://github.com/genu/nuxt-upload-kit/issues/156)) ([#166](https://github.com/genu/nuxt-upload-kit/issues/166)) ([c3536a1](https://github.com/genu/nuxt-upload-kit/commit/c3536a1a5390514f602a075c4d36ed10116e3037))
* **v0.2:** Azure Blob storage server adapter ([#197](https://github.com/genu/nuxt-upload-kit/issues/197)) ([ebfc5ed](https://github.com/genu/nuxt-upload-kit/commit/ebfc5eda3592816e8237f082ba64374111fc9aef))
* **v0.2:** direct upload endpoint and server mode ([#194](https://github.com/genu/nuxt-upload-kit/issues/194)) ([c2c3d3f](https://github.com/genu/nuxt-upload-kit/commit/c2c3d3ffb925b0ed730ac3cbef00bf7a7ae5c640))
* **v0.2:** download and delete endpoints ([#185](https://github.com/genu/nuxt-upload-kit/issues/185)) ([#193](https://github.com/genu/nuxt-upload-kit/issues/193)) ([6b85cb6](https://github.com/genu/nuxt-upload-kit/commit/6b85cb6e058eb0818d41890b10e417109fb39508))
* **v0.2:** Firebase storage server adapter ([#199](https://github.com/genu/nuxt-upload-kit/issues/199)) ([2d28eb0](https://github.com/genu/nuxt-upload-kit/commit/2d28eb04aa5be6b399ceb3c50a29ccb33dc03590))
* **v0.2:** maxBodySize cap on direct upload endpoint ([#200](https://github.com/genu/nuxt-upload-kit/issues/200)) ([7d8a2ff](https://github.com/genu/nuxt-upload-kit/commit/7d8a2ff615b40fac5167294be2ca680617ffd7fc))
* **v0.2:** S3 server adapter + /presign endpoint ([#183](https://github.com/genu/nuxt-upload-kit/issues/183)) ([#192](https://github.com/genu/nuxt-upload-kit/issues/192)) ([c8190a0](https://github.com/genu/nuxt-upload-kit/commit/c8190a06dfd1f26bde556a34a541defff8cb092e))
* **v0.2:** scaffold module server half ([#189](https://github.com/genu/nuxt-upload-kit/issues/189)) ([baa9bb6](https://github.com/genu/nuxt-upload-kit/commit/baa9bb6d9ef379ceead147157ef0c55afe773f02))


### Bug Fixes

* **docs:** fix Vercel deploy by removing conflicting config ([#148](https://github.com/genu/nuxt-upload-kit/issues/148)) ([dd9ff9d](https://github.com/genu/nuxt-upload-kit/commit/dd9ff9daab9228f4aa1c8068b649b86706141cb7))
* **useUploadKit:** prevent duplicate storage uploads on concurrent upload() calls (closes [#169](https://github.com/genu/nuxt-upload-kit/issues/169)) ([#170](https://github.com/genu/nuxt-upload-kit/issues/170)) ([bea55e0](https://github.com/genu/nuxt-upload-kit/commit/bea55e0b31a4fcc49ba43ed5d2a5574e88ab08c7))


### Code Refactoring

* rename initialize/appendExistingFiles to set/addExistingFiles ([#163](https://github.com/genu/nuxt-upload-kit/issues/163)) ([1e8a708](https://github.com/genu/nuxt-upload-kit/commit/1e8a708d23a4ec69344a90b64befb15477223d91))
* unify client/server validation via shared restrictions core ([#212](https://github.com/genu/nuxt-upload-kit/issues/212)) ([2062a54](https://github.com/genu/nuxt-upload-kit/commit/2062a5483d0f414966ceb6f1205054a205112924))

## [0.1.27](https://github.com/genu/nuxt-upload-kit/compare/v0.1.26...v0.1.27) (2026-02-23)


### Bug Fixes

* use dynamic imports for optional ffmpeg dependencies ([#62](https://github.com/genu/nuxt-upload-kit/issues/62)) ([a1a0eea](https://github.com/genu/nuxt-upload-kit/commit/a1a0eea3c924d4f0b9373ed3e9fb1b5bf3ff3041))

## [0.1.26](https://github.com/genu/nuxt-upload-kit/compare/v0.1.25...v0.1.26) (2026-02-13)


### Features

* add appendExistingFiles to unify multi-source file tracking ([#45](https://github.com/genu/nuxt-upload-kit/issues/45)) ([294852f](https://github.com/genu/nuxt-upload-kit/commit/294852f83047d2be44768f56081c4d734a78edce))

## [0.1.25](https://github.com/genu/nuxt-upload-kit/compare/v0.1.24...v0.1.25) (2026-02-13)


### Features

* add thumbnail upload option to the thumbnail generator plugin and update related contexts ([16d1869](https://github.com/genu/nuxt-upload-kit/commit/16d18693139b5560382194f07f39cc119e68ec57))

## [0.1.24](https://github.com/genu/nuxt-upload-kit/compare/v0.1.23...v0.1.24) (2026-02-12)


### Features

* add standalone upload support for storage adapters and thumbnail upload option ([5145649](https://github.com/genu/nuxt-upload-kit/commit/51456494ceae189c4916a69c9434b5094ee0162d))

## [0.1.23](https://github.com/genu/nuxt-upload-kit/compare/v0.1.22...v0.1.23) (2026-02-09)


### Features

* enhance getSASUrl to accept operation parameter for upload, read, and delete actions ([bce0623](https://github.com/genu/nuxt-upload-kit/commit/bce06231814323ab1c52ce8b772d93ddadd3a836))

## [0.1.22](https://github.com/genu/nuxt-upload-kit/compare/v0.1.21...v0.1.22) (2026-02-04)


### Features

* enhance Azure Data Lake storage adapter with dynamic SAS URL handling and improved file client management ([d2aaf75](https://github.com/genu/nuxt-upload-kit/commit/d2aaf756789bd179f6b5fdb44f8c1337e6e31e84))


### Dependencies

* **deps:** update aws-sdk to v3.981.0 ([#14](https://github.com/genu/nuxt-upload-kit/issues/14)) ([01f32f3](https://github.com/genu/nuxt-upload-kit/commit/01f32f3aeb4efad009f52d44376b1a99a71e135c))
* **deps:** update aws-sdk to v3.982.0 ([#16](https://github.com/genu/nuxt-upload-kit/issues/16)) ([fe781cc](https://github.com/genu/nuxt-upload-kit/commit/fe781cc65789cf5406c870660284529c9d71bd00))
* **deps:** update dependency happy-dom to v20.5.0 ([#15](https://github.com/genu/nuxt-upload-kit/issues/15)) ([1b3b5ad](https://github.com/genu/nuxt-upload-kit/commit/1b3b5ade8018558b192e519927d08c758f072704))
* **deps:** update dependency node to v24 ([#11](https://github.com/genu/nuxt-upload-kit/issues/11)) ([3f27e2e](https://github.com/genu/nuxt-upload-kit/commit/3f27e2ef4623f4f4a7afc4c4652668a9a46f9bd3))
* pin aws-sdk and happy-dom versions to specific releases ([e8e4adb](https://github.com/genu/nuxt-upload-kit/commit/e8e4adb419c907d29787d9bef5ef2b47f6e25347))

## v0.1.21

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.20...v0.1.21)

### 💅 Refactors

- Remove retry logic and simplify upload handling in Azure Data Lake plugin ([7a09980](https://github.com/genu/nuxt-upload-kit/commit/7a09980))

### 🏡 Chore

- Dependency updates ([e724e59](https://github.com/genu/nuxt-upload-kit/commit/e724e59))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.20

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.19...v0.1.20)

## v0.1.19

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.18...v0.1.19)

### 💅 Refactors

- Improve Vite dependency optimization configuration ([d972baf](https://github.com/genu/nuxt-upload-kit/commit/d972baf))
- Extract composable logic into focused modules and enhance docs ([03d2fca](https://github.com/genu/nuxt-upload-kit/commit/03d2fca))

### 🏡 Chore

- **release:** V0.1.18 ([cb02d67](https://github.com/genu/nuxt-upload-kit/commit/cb02d67))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.18

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.17...v0.1.18)

### 💅 Refactors

- Improve Vite dependency optimization configuration ([d972baf](https://github.com/genu/nuxt-upload-kit/commit/d972baf))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.17

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.16...v0.1.17)

### 💅 Refactors

- Replace Cloudflare R2 provider with S3-compatible provider ([ee8bf28](https://github.com/genu/nuxt-upload-kit/commit/ee8bf28))

### 📖 Documentation

- Update README and index documentation for multi-provider storage support ([b947107](https://github.com/genu/nuxt-upload-kit/commit/b947107))

### 🏡 Chore

- Formatting ([7c1d0eb](https://github.com/genu/nuxt-upload-kit/commit/7c1d0eb))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.16

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.15...v0.1.16)

### 🚀 Enhancements

- Enhance removeFile function to support conditional deletion from storage with options ([c7a253a](https://github.com/genu/nuxt-upload-kit/commit/c7a253a))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.15

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.14...v0.1.15)

### 🚀 Enhancements

- Enhance removeFile function to conditionally delete from storage based on options ([833e1c5](https://github.com/genu/nuxt-upload-kit/commit/833e1c5))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.14

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.13...v0.1.14)

### 💅 Refactors

- Unify upload result structure by replacing 'key' with 'storageKey' across storage plugins ([32d0bf1](https://github.com/genu/nuxt-upload-kit/commit/32d0bf1))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.13

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.12...v0.1.13)

### 🩹 Fixes

- Include uploadResult in remote file attributes for consistency with newly uploaded files ([c186999](https://github.com/genu/nuxt-upload-kit/commit/c186999))

### ✅ Tests

- Use event-based waiting ([480e974](https://github.com/genu/nuxt-upload-kit/commit/480e974))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.12

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.11...v0.1.12)

### 🚀 Enhancements

- Add initialFiles option to pre-populate uploader with existing files ([ba707ee](https://github.com/genu/nuxt-upload-kit/commit/ba707ee))

### 🏡 Chore

- Update dependencies ([499f934](https://github.com/genu/nuxt-upload-kit/commit/499f934))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.11

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.10...v0.1.11)

### 💅 Refactors

- Simplify externals declaration and remove provider aliases ([267d9e6](https://github.com/genu/nuxt-upload-kit/commit/267d9e6))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.10

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.9...v0.1.10)

### 🏡 Chore

- Add alias for providers ([c00fa29](https://github.com/genu/nuxt-upload-kit/commit/c00fa29))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.9

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.7...v0.1.9)

### 🚀 Enhancements

- **docs:** Update navigation and titles for events and plugins sections ([e8d5230](https://github.com/genu/nuxt-upload-kit/commit/e8d5230))
- Add Cloudflare R2 and Firebase Storage providers for file uploads ([79f3b8a](https://github.com/genu/nuxt-upload-kit/commit/79f3b8a))

### 🩹 Fixes

- Export providers separately ([91a71f6](https://github.com/genu/nuxt-upload-kit/commit/91a71f6))

### 💅 Refactors

- **docs:** Streamline file lifecycle guide by removing redundant sections ([64aba23](https://github.com/genu/nuxt-upload-kit/commit/64aba23))

### 📖 Documentation

- Add Storage Adapters link to navigation ([a2c367c](https://github.com/genu/nuxt-upload-kit/commit/a2c367c))
- Add contributing guide ([ca64334](https://github.com/genu/nuxt-upload-kit/commit/ca64334))

### 🏡 Chore

- Re-organize event tests ([b643bb9](https://github.com/genu/nuxt-upload-kit/commit/b643bb9))
- **release:** V0.1.8 ([ff69d34](https://github.com/genu/nuxt-upload-kit/commit/ff69d34))
- Add issue templates for bug reports and feature requests ([b97016d](https://github.com/genu/nuxt-upload-kit/commit/b97016d))
- Add MIT License file ([55b0a0b](https://github.com/genu/nuxt-upload-kit/commit/55b0a0b))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.8

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.7...v0.1.8)

### 🚀 Enhancements

- **docs:** Update navigation and titles for events and plugins sections ([e8d5230](https://github.com/genu/nuxt-upload-kit/commit/e8d5230))
- Add Cloudflare R2 and Firebase Storage providers for file uploads ([79f3b8a](https://github.com/genu/nuxt-upload-kit/commit/79f3b8a))

### 💅 Refactors

- **docs:** Streamline file lifecycle guide by removing redundant sections ([64aba23](https://github.com/genu/nuxt-upload-kit/commit/64aba23))

### 🏡 Chore

- Re-organize event tests ([b643bb9](https://github.com/genu/nuxt-upload-kit/commit/b643bb9))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.7

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.6...v0.1.7)

## v0.1.6

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.5...v0.1.6)

## v0.1.5

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.4...v0.1.5)

### 🚀 Enhancements

- Add files:uploaded event and prevent duplicate emissions ([e3aed73](https://github.com/genu/nuxt-upload-kit/commit/e3aed73))

### 🩹 Fixes

- Improve handling of file IDs in getRemoteFile and runPluginStage functions ([648e823](https://github.com/genu/nuxt-upload-kit/commit/648e823))

### 💅 Refactors

- Rename autoProceed option to autoUpload for clarity ([f938e09](https://github.com/genu/nuxt-upload-kit/commit/f938e09))

### 🏡 Chore

- Update README to remove outdated sections and improve documentation structure ([27b0701](https://github.com/genu/nuxt-upload-kit/commit/27b0701))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.4

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.3...v0.1.4)

### 🏡 Chore

- Exclude FFmpeg packages from Vite's dependency optimization ([f9c41f7](https://github.com/genu/nuxt-upload-kit/commit/f9c41f7))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.3

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.2...v0.1.3)

### 🚀 Enhancements

- Add types, plugins, and validators export ([c77387f](https://github.com/genu/nuxt-upload-kit/commit/c77387f))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.2

[compare changes](https://github.com/genu/nuxt-upload-kit/compare/v0.1.1...v0.1.2)

### 🚀 Enhancements

- Update Releases page and navigation links to use internal routing ([af3b96b](https://github.com/genu/nuxt-upload-kit/commit/af3b96b))

### 🏡 Chore

- Lint/format ([0960f22](https://github.com/genu/nuxt-upload-kit/commit/0960f22))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>

## v0.1.1


### 🚀 Enhancements

- Add Vercel configuration and update MCP settings ([239567b](https://github.com/genu/nuxt-upload-kit/commit/239567b))
- Add AppHeaderTitle component and logo assets ([48962f4](https://github.com/genu/nuxt-upload-kit/commit/48962f4))
- Add hero-gradient styles to main.css and include in nuxt.config.ts ([8dd4b49](https://github.com/genu/nuxt-upload-kit/commit/8dd4b49))
- Restructure AppHeader component and update logo handling in app.config.ts ([79d6be5](https://github.com/genu/nuxt-upload-kit/commit/79d6be5))

### 🩹 Fixes

- Update markdown syntax for page sections and buttons in index.md ([b623e01](https://github.com/genu/nuxt-upload-kit/commit/b623e01))
- Center align title and description in README.md ([319752a](https://github.com/genu/nuxt-upload-kit/commit/319752a))
- Format feature cards for Azure Data Lake, Amazon S3, and Cloudinary in index.md ([34a6cdc](https://github.com/genu/nuxt-upload-kit/commit/34a6cdc))
- Update .prettierignore to include pnpm-lock.yaml ([587f966](https://github.com/genu/nuxt-upload-kit/commit/587f966))

### 🏡 Chore

- Initial commit ([69c57d5](https://github.com/genu/nuxt-upload-kit/commit/69c57d5))
- Update ([376683d](https://github.com/genu/nuxt-upload-kit/commit/376683d))
- Update ([6a38277](https://github.com/genu/nuxt-upload-kit/commit/6a38277))
- Rename to `useUploadKit` ([15ead66](https://github.com/genu/nuxt-upload-kit/commit/15ead66))
- Use vercel.ts ([bc1c0fe](https://github.com/genu/nuxt-upload-kit/commit/bc1c0fe))
- Add .prettierignore to exclude markdown files from formatting ([a73eca0](https://github.com/genu/nuxt-upload-kit/commit/a73eca0))
- Add unit tests for upload validators and utility functions ([3388363](https://github.com/genu/nuxt-upload-kit/commit/3388363))
- Lint and format ([f2df13d](https://github.com/genu/nuxt-upload-kit/commit/f2df13d))

### ❤️ Contributors

- Eugen Istoc <eugenistoc@gmail.com>
