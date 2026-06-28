import { resolve } from "node:path";
import { defineConfig } from "vite";

// Relative base ("./") keeps asset URLs portable: the build works at a domain
// root or under a GitHub Pages project subpath without further configuration.
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "about.html"),
        guides: resolve(__dirname, "guides.html"),
      },
    },
  },
});
