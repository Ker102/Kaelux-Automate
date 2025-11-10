import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig & { turbopack: { root: string } } = {
  reactCompiler: true,
  turbopack: {
    root: path.join(__dirname),
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@langchain/core/documents": path.resolve(
        __dirname,
        "node_modules/@langchain/core/documents.js"
      ),
      "@langchain/core/embeddings": path.resolve(
        __dirname,
        "node_modules/@langchain/core/embeddings.js"
      ),
    };
    return config;
  },
};

export default nextConfig;
