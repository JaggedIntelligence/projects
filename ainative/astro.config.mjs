import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'AI Native',

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
        {
          label: 'Resources',
          items: [
            {
              label: "Community content",
              link: "/resources/community-content",
            },
            {
              label: "Plugins",
              link: "/resources/plugins",
            },
            {
              label: "Themes",
              link: "/resources/themes",
            },

          ],
        },
      ],
    }),
  ],
});
