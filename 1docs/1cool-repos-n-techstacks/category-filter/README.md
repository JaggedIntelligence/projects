# Technical explanation of how this Category Filter Page works

### Big picture
 - This page is very fast filtering
 - https://javimosch.github.io/supercli/plugins.html
 - part of the reason may be, it is not using any React or other Libs, pure JS Document functions
 - .
 - Another good point about this is the main page index.html import .md file and renders using marketd.js lib
 - this is useful to produce STAND ALONE HTML documentaiton STICHING multiple .md files
 - .

### the Page flow is as follows
- **1/ main entry page** https://javimosch.github.io/supercli/index.html
- all the Left Menu and most HTML is part of index.html page , see View Source, it is saved as index.html in this folder
- when you click "Server" menu option, it is  #server but it is loaded from   /server.md file at Load time, see JS script below
- the downloaded .md file is parsed using "marked" JS lib using this scirpt tag
-  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
-  the lib github repo is https://github.com/markedjs/marked

```
// Load server documentation dynamically
      async function loadServerDocs() {
        try {
          const res = await fetch('server.md');
          const markdown = await res.text();
          const html = marked.parse(markdown);
          document.getElementById('server-content').innerHTML = html;
        } catch (err) {
          document.getElementById('server-content').innerHTML = '<p class="text-red-500">Failed to load server documentation</p>';
        }
      }
      loadServerDocs();
```
- 
- **2/ the category filter** DATA is loaded from "meta-plugins.json" file ( same file saved in this folder)
-  the category filter page is having this "loadPlugins()" function to get the .json DATA file
-  https://javimosch.github.io/supercli/plugins.html
```
async function loadPlugins() {
        try {
          const res = await fetch('meta-plugins.json');
          const data = await res.json();
          allPlugins = data.plugins || [];
          renderTagFilters();
          filterPlugins();
        } catch (err) {
          document.getElementById('pluginGrid').innerHTML = '<p class="text-red-400 col-span-3">Failed to load plugins</p>';
        }
      }
```
