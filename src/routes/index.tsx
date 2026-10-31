import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const PrototypeApp = lazy(() => import("@/prototype/original-inspired/AndradePrototypeOriginalInspired"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Andrade Agro — Sistema de Abastecimento" },
      { name: "description", content: "Controle de abastecimentos, frota, manutenções e relatórios da Andrade Agro." },
      { property: "og:title", content: "Andrade Agro — Sistema de Abastecimento" },
      { property: "og:description", content: "Controle de abastecimentos, frota, manutenções e relatórios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#031d16", color: "#FACC15" }}>
      Carregando…
    </div>
  );
}

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <PrototypeApp />
    </Suspense>
  );
}
