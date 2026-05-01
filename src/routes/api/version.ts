import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          name: "MeterFlow API",
          version: "0.1.0",
          phase: "scaffold",
        });
      },
    },
  },
});
