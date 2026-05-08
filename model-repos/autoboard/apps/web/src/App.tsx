import { Routes, Route } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import { store } from "./atoms/log-drawer";
import LogDrawer from "./components/LogDrawer";
import Index from "./pages/Index";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

function AppContent() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <LogDrawer />
    </>
  );
}

export default function App() {
  return (
    <JotaiProvider store={store}>
      <main>
        <AppContent />
      </main>
    </JotaiProvider>
  );
}
