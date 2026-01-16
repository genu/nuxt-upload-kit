import { defineBuildConfig } from "unbuild"

const providers = ["aws-s3", "cloudflare-r2", "azure-datalake", "firebase"]

export default defineBuildConfig({
  entries: providers.map((name) => ({
    input: `src/providers/${name}`,
    name: `providers/${name}`,
    declaration: true,
  })),
  externals: [
    // Mark provider-specific dependencies as external
    "@azure/storage-file-datalake",
    "firebase/storage",
  ],
})
