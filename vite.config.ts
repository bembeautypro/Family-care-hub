import { defineConfig } from "@tanstack/react-start/config";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    preset: "vercel",
  },
  tsr: {
    generatedRouteTree: "./src/routeTree.gen.ts",
    routesDirectory: "./src/routes",
  },
  vite: {
    plugins: [tailwindcss(), tsConfigPaths()],
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
  },
});
