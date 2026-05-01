import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider, type AuthState } from "@/context/auth";
import { ThemeProvider } from "@/context/theme";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

interface MyRouterContext {
  auth: AuthState;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card max-w-md rounded-2xl p-10 text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MeterFlow — API Usage Billing Platform" },
      {
        name: "description",
        content:
          "Create APIs, generate keys, track usage, and bill customers. The developer-first metering platform.",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      { property: "og:title", content: "MeterFlow — API Usage Billing Platform" },
      { name: "twitter:title", content: "MeterFlow — API Usage Billing Platform" },
      { name: "description", content: "API Billing Hub is a SaaS platform for developers to manage API usage, keys, and billing." },
      { property: "og:description", content: "API Billing Hub is a SaaS platform for developers to manage API usage, keys, and billing." },
      { name: "twitter:description", content: "API Billing Hub is a SaaS platform for developers to manage API usage, keys, and billing." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6fee5829-ea5b-4cf2-b8b1-6dcbc60af657/id-preview-fa88a585--0f0662d6-d7c0-494e-a93f-7bbaa85d57a4.lovable.app-1776709607617.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6fee5829-ea5b-4cf2-b8b1-6dcbc60af657/id-preview-fa88a585--0f0662d6-d7c0-494e-a93f-7bbaa85d57a4.lovable.app-1776709607617.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
