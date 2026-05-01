import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Sidebar } from "@/components/Sidebar";
import {
  Activity,
  Loader2,
  Menu,
  X,
  LayoutDashboard,
  Boxes,
  KeyRound,
  BarChart3,
  Sparkles,
  CreditCard,
  UserCircle,
  LogOut,
  Moon,
  Sun,
  ShieldAlert,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { toast } from "sonner";

const mobileNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/apis", label: "APIs", icon: Boxes },
  { to: "/keys", label: "API Keys", icon: KeyRound },
  { to: "/usage", label: "Usage", icon: BarChart3 },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    // If auth context is not yet available (first render), allow through
    // — the component-level guard below will handle redirection.
    if (!context.auth) return;

    // If auth has finished loading and user is NOT authenticated, redirect to login
    if (!context.auth.isLoading && !context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    // If still loading, allow render — AppLayout will show a spinner
  },
  component: AppLayout,
});

function AppLayout() {
  const { isLoading, isAuthenticated, signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", search: { redirect: location.href } });
    }
  }, [isLoading, isAuthenticated, navigate, location.href]);

  // Show a loading spinner while auth is resolving
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  const isAdmin = user?.email === "mohanrajit05@gmail.com";
  const activeMobileNav = isAdmin
    ? [...mobileNav, { to: "/admin", label: "Platform Admin", icon: ShieldAlert }]
    : mobileNav;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 glass border-b md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-bold">MeterFlow</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-14 right-0 bottom-0 z-40 w-64 transform glass border-l transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <nav className="flex-1 space-y-1 p-4">
          {activeMobileNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (

              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-4">
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>

      <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12 md:pt-8 pt-20">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
