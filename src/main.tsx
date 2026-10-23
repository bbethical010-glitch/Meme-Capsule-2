import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./admin/AdminApp";
import AdminGate from "./admin/AdminGate";
import CatApp from "./categorise/CatApp";
import CurateApp from "./curate/CurateApp";
import AnalyticsPreviewPage from "./curate/analytics-preview/AnalyticsPreviewPage";
import AiJudgeApp from "./ai-judge/AiJudgeApp";
import "./base.css";

function RootRouter() {
  const [route, setRoute] = useState(() => ({
    pathname: window.location.pathname,
    hash: window.location.hash
  }));

  useEffect(() => {
    const handleNavigation = () => {
      setRoute({
        pathname: window.location.pathname,
        hash: window.location.hash
      });
    };

    window.addEventListener("hashchange", handleNavigation);
    window.addEventListener("popstate", handleNavigation);
    return () => {
      window.removeEventListener("hashchange", handleNavigation);
      window.removeEventListener("popstate", handleNavigation);
    };
  }, []);

  if (route.pathname.startsWith("/admin")) {
    return (
      <div className="admin-theme" style={{ minHeight: "100vh", background: "var(--background)", color: "var(--on-surface)" }}>
        <AdminGate>
          <AdminApp />
        </AdminGate>
      </div>
    );
  }

  if (route.pathname.startsWith("/curate/analytics") || route.hash.startsWith("#/curate/analytics")) {
    return <AnalyticsPreviewPage />;
  }

  if (route.pathname.startsWith("/curate") || route.hash.startsWith("#/curate")) {
    return <CurateApp />;
  }

  if (route.pathname.startsWith("/ai-judge") || route.hash.startsWith("#/ai-judge")) {
    return <AiJudgeApp />;
  }

  if (route.pathname.startsWith("/categorise") || route.hash.startsWith("#/categorise")) {
    return <CatApp />;
  }

  // Default entry route for internal tool workbench
  return <CurateApp />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}
