// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    imageService: true, // Optimisation images Vercel
  }),
  image: {
    // Lazy loading natif + formats modernes
    experimentalLayout: 'responsive',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Optimisations build
      cssMinify: 'lightningcss',
    }
  },
  compressHTML: true, // Minifier le HTML
});
