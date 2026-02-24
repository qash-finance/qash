import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "@miden-sdk/miden-sdk",
    "@miden-sdk/miden-para",
    "@miden-sdk/use-miden-para-react",
    "@openzeppelin/miden-multisig-client",
    "@openzeppelin/psm-client",
  ],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    // Prevent WASM from being bundled on the server
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@miden-sdk/miden-sdk");
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.SERVER_URL || "http://localhost:4001"}/:path*`,
      },
      {
        source: "/docs/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
  transpilePackages: ["@getpara/web-sdk", "@getpara/react-sdk"],
  // async headers() {
  //   return [
  //     {
  //       source: "/(.*)",
  //       headers: [
  //         {
  //           key: "Cross-Origin-Embedder-Policy",
  //           value: "require-corp",
  //         },
  //         {
  //           key: "Cross-Origin-Opener-Policy",
  //           value: "same-origin",
  //         },
  //       ],
  //     },
  //   ];
  // },
  output: "standalone",
};

export default nextConfig;
