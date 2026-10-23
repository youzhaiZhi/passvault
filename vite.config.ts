import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，构建产物可以部署在任意子路径下（例如 GitHub Pages 的 /passvault/）
export default defineConfig({
  base: './',
  plugins: [react()],
});
