import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const basePlugins = [
  TanStackRouterVite({ autoCodeSplitting: true }),
  viteReact(),
  tailwindcss(),
];


// https://vitejs.dev/config/
export default defineConfig({
  plugins: basePlugins,
});
