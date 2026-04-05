import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({mode}) => {
  // `config/env` ディレクトリの環境変数をロード
  process.env = {...process.env, ...loadEnv(mode, path.resolve(__dirname, "config/env"), "")};
  return {
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  }
});
