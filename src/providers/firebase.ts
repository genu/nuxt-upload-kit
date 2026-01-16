/**
 * Firebase Storage Adapter
 *
 * This adapter requires the `firebase` package to be installed.
 *
 * @example
 * ```bash
 * npm install firebase
 * # or
 * pnpm add firebase
 * ```
 *
 * @example
 * ```typescript
 * import { PluginFirebaseStorage } from "nuxt-upload-kit/providers/firebase"
 * import { getStorage } from "firebase/storage"
 * import { initializeApp } from "firebase/app"
 *
 * const app = initializeApp({ ... })
 * const storage = getStorage(app)
 *
 * const uploader = useUploadKit({
 *   storage: PluginFirebaseStorage({ storage })
 * })
 * ```
 *
 * @experimental This adapter is experimental and may change in future releases.
 */
export {
  PluginFirebaseStorage,
  type FirebaseStorageOptions,
  type FirebaseStorageUploadResult,
} from "../runtime/composables/useUploadKit/plugins/storage/firebase-storage"
