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
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true
      }),
      tailwindcss(),
    ],
  };
});
