import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: apiProxyTarget
      ? {
          "/api": {
            target: apiProxyTarget,
            changeOrigin: true,
          },
        }
      : undefined,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("maplibre-gl")) return "map-engine";
          if (id.includes("echarts") || id.includes("zrender")) {
            return "chart-engine";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "react-runtime";
          }
          return undefined;
        },
      },
    },
  },
});
