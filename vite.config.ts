import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      minify: false, // Disable minification to save memory
      sourcemap: false,
      rollupOptions: {
        maxParallelFileOps: 1, // Reduce parallel operations
      }
    },
    server: {
      host: "0.0.0.0",
      port: 3000
    }
  }
});
