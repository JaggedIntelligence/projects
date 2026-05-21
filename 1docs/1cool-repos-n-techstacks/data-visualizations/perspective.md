# Perspective : Data visualization components

### What is it

- Perspective is an interactive analytics and data visualization component for large and streaming datasets. Build user-configurable reports, dashboards, notebooks, and applications with a high-performance query engine compiled to WebAssembly, Python, and Rust.
- https://perspective-dev.github.io/guide/perspective.html

- **Features**
  - A framework-agnostic user interface packaged as a Custom Element, which connects to a Data Model in-browser (via WebAssembly) or remotely (via WebSocket, with integration in Python, Node.js and Rust).

  - A Data Model API for pluggable engines, enabling Perspective’s UI to query external data sources like DuckDB while translating view configurations into native queries.
 
### Perspective Details

Supports :
  - ClickHouse, DuckDB and Custom Virtual servers
  - https://perspective-dev.github.io/guide/how_to/javascript/virtual_server/custom.html

Server only on Node.js:
  - For exceptionally large datasets, a Client can be bound to a perspective.table() instance running in Node.js/Python/Rust remotely, rather than creating one in a Web Worker and downloading the entire data set. This trades off network bandwidth and server resource requirements for a smaller browser memory and CPU footprint.
  - https://perspective-dev.github.io/guide/how_to/javascript/nodejs_server.html
    
React Componet : 
  - We provide a React wrapper to prevent common issues and mistakes associated with using the perspective-viewer web component in the context of React.
  - https://perspective-dev.github.io/guide/how_to/javascript/react.html
