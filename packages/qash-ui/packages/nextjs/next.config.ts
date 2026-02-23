import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack: config => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
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
  transpilePackages: ["@getpara/web-sdk", "@getpara/react-sdk", "@miden-sdk/miden-para", "@miden-sdk/use-miden-para-react", "@openzeppelin/miden-multisig-client", "@openzeppelin/psm-client"],
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
