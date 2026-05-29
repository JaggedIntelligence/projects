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
          label: 'Intro',
          items: [
            { label: 'Introduction', slug: 'intro' },
            { label: 'Intro2', slug: 'intro2' },

          ],
        },
        {
          label: 'Resources',
          items: [
            // Each item here is one entry in the navigation menu.
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

        {
          label: 'Guides',
          items: [
            // Each item here is one entry in the navigation menu.
            {
              label: "Authoring content",
              link: "/guides/authoring-content",
            },
            {
              label: "Pages",
              link: "/guides/pages",
            },
            {
              label: "Project structure",
              link: "/guides/project-structure",
            },

          ],
        },

      ],
    }),
  ],
});
