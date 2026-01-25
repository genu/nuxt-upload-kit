import { defineBuildConfig } from "unbuild"

const providers = ["s3", "azure-datalake", "firebase"]

export default defineBuildConfig({
  entries: providers.map((name) => ({
    input: `src/providers/${name}`,
    name: `providers/${name}`,
    declaration: true,
  })),
  externals: ["@azure/storage-file-datalake", "firebase/storage"],
})
