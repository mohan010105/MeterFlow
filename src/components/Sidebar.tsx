import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
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
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { toast } from "sonner";

import { useState, useEffect } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/apis", label: "APIs", icon: Boxes },
  { to: "/keys", label: "API Keys", icon: KeyRound },
  { to: "/usage", label: "Usage", icon: BarChart3 },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  const isAdmin = user?.email === "mohanrajit05@gmail.com";
  const activeNav = isAdmin
    ? [...nav, { to: "/admin", label: "Platform Admin", icon: ShieldAlert }]
    : nav;

  return (
    <aside className="glass sticky top-0 hidden h-screen w-64 flex-col border-r p-4 md:flex">
      <div className="mb-6 flex items-center justify-between px-2 pt-2">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-[var(--shadow-glow)]">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold">MeterFlow</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={mounted ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
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
      </div>

      <nav className="flex-1 space-y-1">
        {activeNav.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (

            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-border/60 pt-4">
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
    </aside>
  );
}
