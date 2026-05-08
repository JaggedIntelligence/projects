import { useEffect } from "react";

export default function About() {
  useEffect(() => {
    document.title = "About - Autoboard";
  }, []);
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>About</h1>
      <p>Autoboard - Kanban board for your projects.</p>
    </div>
  );
}
