import { defineConfig } from "vite";
import path from "path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          // 这里可以修改 Less 变量
        },
        // 全局引入 Less 文件
        additionalData: `@import "@/styles/mixins.less";`,
        javascriptEnabled: true,
      },
    },
  },
  plugins: [vue()],
  server: {
    port: 3000,
  },
});
