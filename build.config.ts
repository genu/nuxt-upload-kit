import { defineBuildConfig } from "unbuild"

const providers = ["s3", "azure-datalake", "firebase"]
const serverEntries = ["index", "s3", "azure"]

export default defineBuildConfig({
  entries: [
    ...providers.map((name) => ({
      input: `src/providers/${name}`,
      name: `providers/${name}`,
      declaration: true,
    })),
    ...serverEntries.map((name) => ({
      input: `src/server/${name}`,
      name: `server/${name}`,
      declaration: true,
    })),
  ],
  externals: [
    "@azure/storage-blob",
    "@azure/storage-file-datalake",
    "firebase/storage",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "h3",
  ],
})
