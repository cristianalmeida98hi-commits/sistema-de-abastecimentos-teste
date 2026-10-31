import { createFileRoute } from "@tanstack/react-router";
import { PrototypeApp } from "@/prototype/PrototypeApp";

export const Route = createFileRoute("/prototipo")({
  head: () => ({
    meta: [
      { title: "Andrade Agro — Protótipo visual" },
      { name: "description", content: "Protótipo de redesign do painel Andrade Agro com dados fictícios." },
      { property: "og:title", content: "Andrade Agro — Protótipo visual" },
      { property: "og:description", content: "Redesign escuro do painel de abastecimento e frota, com dados fictícios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrototypeApp,
});
