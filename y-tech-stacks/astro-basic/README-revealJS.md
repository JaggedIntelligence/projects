# Astro with Reveal.JS for presentations

### How this is built
- took basic Astro (see README.md just below file) and did npm install reveal.js
- SR Note: I am glad I explored ASTRO in the past, the muscle memory recalled , I looked at web
- now ASTRO works with React.js and Reveal.js etc.. 
- This Reveal.js with Zero-to-Agent copied CSS styles are SREDDY goto presetaion standard ..

### CSS styles copied from are working
 - except the Page margin are little smaller, so content is pushed Down
 - except H2 etc.. are little bigger
 - look into this later
 - good part  2 Images on page /2aiagent is working ..

### folder structure
 - src/layouts -- can have multiple layouts 
 - src/pages 

 we have 2 layouts
  /layouts/PresentationLayout.astro   // the default layout that came out with instllation of Astro

  /layouts/ZerotoAILayout.astro  // we copied it from  /pages/zeroto-agent-original.html 
  
  ( /pages/zeroto-agent-original.html is  from view-source of this WHOLE presentation  https://haas-ai-classes.vercel.app/class4.html#/the-harness-where-engineering-lives )