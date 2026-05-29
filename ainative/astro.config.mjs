import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',

      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        fr: {
          label: 'Français',
          lang: 'fr',
        },
      },
      
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Introduction', slug: 'intro' },
            { label: 'Intro2', slug: 'intro2' },

          ],
        },
      ],
    }),
  ],
});
