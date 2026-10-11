# Feature: HTML To ReactJS Port

## Goal

Port a static HTML documentation page into the existing Next.js app at `/concepts`.

The first version is intentionally narrow:

- User opens `/concepts`.
- The page appears below the existing app menu bar.
- The page consumes the full remaining viewport.
- There is no outer page padding.
- The static HTML body content from `sample.html` is represented as React JSX in `page.tsx`.
- The old static page behavior is preserved where useful: TOC filtering, heading anchors, and split-pane resizing.

This feature is a design/prototype route for bringing static generated HTML into the app shell without rewriting the content model yet.

## Source

Input file:

```text
app/(app)/concepts/sample.html
```

The sample HTML is a generated documentation page based on `simple-statistics-docs`.

It includes:

- A left sidebar with title, version, filter input, and table of contents.
- A right content pane with documentation sections.
- Remote CSS imports for Basscss/documentation styles.
- Remote JavaScript imports for anchors, split panes, filtering, and scroll restoration.

## SREDDY Note on How to give sensible Input Starter files to Codex ...
 - I am glad I gave the sample.html a working file **instead of randombly asking for CSS Styles and interaction**.
 - Codex took the input sample.html mentioned in .html file and imported CSS styles selectively instead of whole file
 - for JS files of sample.html, it discarded and implemented the required Drag and Filter functionaly in concepts-docs-interactions.tsx file 
 - this gave GREAT experice for SREDY , how to convert a good working UI/UX html code into React.js .. 
 - the pain and Approach SREDDY took is good, edited the HUGE big file and cut into small sample.html file ( by removing all unnacessariy links etc..) so Codex can understand it easily.

## Implemented Files

Route:

```text
app/(app)/concepts/page.tsx
```

Route-scoped styling:

```text
app/(app)/concepts/concepts.module.css
```

Client-side interaction shim:

```text
app/(app)/concepts/concepts-docs-interactions.tsx
```

Reference source retained:

```text
app/(app)/concepts/sample.html
```

## Key Design Decision

Do not import the upstream CSS and JavaScript files directly into the app.

Instead:

- Convert the visible HTML body into JSX.
- Move document title and description into route metadata.
- Recreate only the CSS classes required by this sample inside a CSS module.
- Reimplement the small required browser behaviors locally in a route-specific client component.

Reason:

- The upstream CSS contains broad global selectors such as `a`, `h4`, `table`, and utility class names like `.flex`.
- Loading those styles globally could affect the app shell, menu bar, and other routes.
- Keeping styles under `concepts.module.css` limits the blast radius to this route.
- Avoiding remote runtime JavaScript removes ordering and availability risk.

## Next.js Porting Rules

The static HTML file cannot be pasted into `page.tsx` as-is.

These parts are not valid inside a route component:

```text
<!doctype html>
<html>
<head>
<body>
```

The port maps them as follows:

```text
HTML document shell  -> owned by app/layout.tsx
<title>              -> page metadata.title
description meta     -> page metadata.description
<body> content       -> JSX returned by ConceptsPage
CSS imports          -> concepts.module.css
JS imports           -> ConceptsDocsInteractions
```

## Route Layout

The route lives under the existing app route group:

```text
app/(app)/concepts/page.tsx
```

This means `/concepts` inherits:

- `AppShell`
- the sticky top menu bar
- theme/provider setup
- task editor mounting from the app layout

The page itself is responsible for filling only the area below the menu bar.

Route height:

```css
height: calc(100vh - 4rem - 1px);
```

Reason:

- The app menu bar is `h-16`, which is `4rem`.
- The header also has a 1px bottom border.
- Subtracting both lets the concepts page start immediately under the menu and end exactly at the viewport bottom.

## JSX Conversion

The visible content from `sample.html` was converted mechanically:

- `class` became `className`.
- `spellcheck` became `spellCheck`.
- `autocapitalize` became `autoCapitalize`.
- `autocorrect` became `autoCorrect`.
- Void elements such as `<input>` became self-closing JSX.
- The body class `documentation m0` became route wrapper styling in the CSS module.

The current JSX preserves the sample structure:

```text
main[data-concepts-docs]
  split-left
    title
    version
    filter input with clear button
    toc links
  split-gutter
  split-right
    section heading
    content sections
```

## Styling Design

The route uses a CSS module:

```text
concepts.module.css
```

The wrapper class is:

```text
styles.conceptsDocs
```

The old documentation utility classes are recreated only under that wrapper:

```css
.conceptsDocs :global(.flex) { ... }
.conceptsDocs :global(.overflow-auto) { ... }
.conceptsDocs :global(.p2) { ... }
```

This gives the sample HTML its expected class names while preventing those class names from becoming app-wide utilities.

Important styling behavior:

- Full route height below the app header.
- No route-level padding.
- Left and right panes scroll independently.
- Gutter uses the original split-pane drag handle background image.
- Filter input is half-width in the normal desktop sidebar.
- Filter input can expand to the available sidebar width when the sidebar is dragged narrow.
- Mobile layout stacks panes vertically and hides the gutter.

## Filter Control Design

The filter control is intentionally small and local to the sidebar.

Desktop behavior:

```text
filter wrapper width = 50%
input width          = 100% of wrapper
```

When the left sidebar is dragged near its minimum readable width, the filter is allowed to use the available space rather than staying rigidly half-width.

Mobile behavior:

```text
filter wrapper width = 100%
```

The clear affordance is a button inside the input wrapper:

```text
button[aria-label="Clear filter"][data-filter-clear]
```

Behavior:

- Hidden when the filter input is empty.
- Visible when the user has typed filter text.
- Clicking it clears the input value.
- Clicking it restores all TOC items.
- Clicking it returns focus to the filter input.

The icon uses the existing app dependency:

```text
lucide-react X
```

## Interaction Design

The original sample imported:

```html
<script src="https://simple-statistics.github.io/docs/assets/anchor.js"></script>
<script src="https://simple-statistics.github.io/docs/assets/split.js"></script>
<script src="https://simple-statistics.github.io/docs/assets/site.js"></script>
```

These were replaced with:

```text
ConceptsDocsInteractions
```

Implemented behaviors:

- Add anchor links to `h3[id]` headings.
- Skip headings marked with `no-anchor`.
- Filter TOC items as the user types in the filter input.
- Show the filter clear button only when filter text is present.
- Clear filter text and restore all TOC items from the clear button.
- Pressing Enter in the filter input navigates to the first visible TOC item.
- Dragging the gutter resizes the left and right panes.
- Left pane can be dragged down to an approximately `120px` readable minimum.
- Hash changes scroll the matching target into view.

The implementation is route-scoped by querying inside:

```text
[data-concepts-docs]
```

## Out Of Scope

This first port does not include:

- A generic HTML-to-JSX converter pipeline.
- Parsing arbitrary future HTML files at runtime.
- Importing all upstream CSS files.
- Importing upstream JavaScript files.
- A content schema for docs.
- Navigation menu changes.
- Replacing the repeated placeholder documentation text.
- Server-side rendering of dynamic generated docs.

## Verification

Checks performed:

```bash
pnpm exec tsc --noEmit
```

Manual browser verification on `/concepts`:

- Route loads with the expected document title.
- Page starts immediately below the app header.
- Page bottom aligns with the viewport bottom.
- Left and right panes render.
- Filter input is half-width at normal sidebar width.
- TOC filter narrows visible items.
- Clear button appears after typing filter text.
- Clear button empties the filter, restores all TOC items, and focuses the input.
- Gutter drag changes pane widths.
- Left pane can drag farther left to the readable `120px` minimum.
- Heading anchors are added.
- Browser console has no route errors.

## Known Follow-Ups

Possible future improvements:

- Add `/concepts` to the app shell navigation when the route is ready for normal use.
- Replace copied sample text with real concept documentation.
- Extract docs section data into a structured array if content editing becomes frequent.
- Add a small component test for the filter behavior.
- Add an E2E smoke test for the split-pane route.
- Decide whether `sample.html` remains as a permanent fixture or becomes temporary migration input.
