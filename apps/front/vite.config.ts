import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // `config/env` ディレクトリの環境変数をロード
  process.env = {
    ...process.env,
    ...loadEnv(mode, path.resolve(__dirname, "config/env"), ""),
  };
  return {
    envDir: path.resolve(__dirname, "config/env"),
    define: {
      "process.env.API_BASE_URL": JSON.stringify(process.env.API_BASE_URL ?? ""),
    },
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "src"),
      },
    },
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      tailwindcss(),
    ],
  };
});
