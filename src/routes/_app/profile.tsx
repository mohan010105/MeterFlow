import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { LogOut, Copy, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — MeterFlow" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <>
      <PageHeader title="Profile" description="Your account details." />

      <div className="glass-card max-w-2xl rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-display text-lg font-semibold">
              {user?.user_metadata?.display_name || "Developer"}
            </div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
        </div>

        <div className="mt-8 space-y-4 border-t border-border/60 pt-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Email
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm">{user?.email}</span>
              {user?.email && (
                <button
                  onClick={() => copyToClipboard(user.email!, "Email")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy email"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              User ID
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="font-mono text-xs text-muted-foreground">
                {user?.id}
              </code>
              {user?.id && (
                <button
                  onClick={() => copyToClipboard(user.id, "User ID")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy User ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Theme preference */}
        <div className="mt-8 space-y-4 border-t border-border/60 pt-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Theme
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                {mounted ? (
                  theme === "dark" ? (
                    <>
                      <Sun className="h-4 w-4 text-primary" />
                      Switch to Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 text-primary" />
                      Switch to Dark Mode
                    </>
                  )
                ) : (
                  <div className="w-32 h-4" />
                )}
              </button>
              <span className="text-xs text-muted-foreground capitalize">
                Currently: {mounted ? theme : "---"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4 border-t border-border/60 pt-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Support
            </div>
            <div className="mt-1 text-sm">
              Need help? Contact us at{" "}
              <a href="mailto:mohanrajit05@gmail.com" className="text-primary hover:underline">
                mohanrajit05@gmail.com
              </a>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-8 inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );
}
