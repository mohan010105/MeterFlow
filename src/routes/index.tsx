import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Activity,
  KeyRound,
  BarChart3,
  CreditCard,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MeterFlow — API Usage Billing Platform for Developers" },
      {
        name: "description",
        content:
          "Ship APIs, meter every request, and bill customers automatically. MeterFlow gives developers a unified platform for keys, usage analytics, and billing.",
      },
      {
        property: "og:title",
        content: "MeterFlow — API Usage Billing Platform",
      },
      {
        property: "og:description",
        content: "Meter every request. Bill every customer. Ship faster.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [apiHealth, setApiHealth] = useState<string>("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setApiHealth(d.status))
      .catch(() => setApiHealth("offline"));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            API status:{" "}
            <span className="font-medium text-foreground">{apiHealth}</span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Meter every request. <br />
            <span className="text-gradient">Bill every customer.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            MeterFlow is the developer-first platform to ship APIs, generate
            keys, track usage in real-time, and bill automatically — without
            building infrastructure from scratch.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-[1.02]"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="glass inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Everything you need to ship paid APIs
            </h2>
            <p className="mt-3 text-muted-foreground">
              Four primitives. Zero glue code.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Activity,
                title: "API Catalog",
                desc: "Register your APIs once. Version, document, and gate access from one place.",
              },
              {
                icon: KeyRound,
                title: "API Keys",
                desc: "Issue, scope, and revoke keys per customer. Rate limits built in.",
              },
              {
                icon: BarChart3,
                title: "Usage Analytics",
                desc: "Real-time metrics for every endpoint, customer, and plan.",
              },
              {
                icon: CreditCard,
                title: "Billing",
                desc: "Per-call, tiered, or seat-based. Invoices generated automatically.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass-card group rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary shadow-[var(--shadow-glow)]">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary feature row */}
      <section id="pricing" className="mt-32 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="glass-card grid grid-cols-1 gap-10 rounded-3xl p-10 lg:grid-cols-3 lg:p-14">
            <div>
              <Zap className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-xl font-semibold">
                Sub-millisecond metering
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Edge-deployed counters. Your endpoints stay fast.
              </p>
            </div>
            <div>
              <Shield className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-xl font-semibold">
                Production-grade security
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Row-level isolation, hashed keys, audit trails out of the box.
              </p>
            </div>
            <div>
              <CreditCard className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-xl font-semibold">
                Razorpay-ready billing
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Drop in your provider. Usage flows straight to invoices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-32 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight">
            Start metering in minutes.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free tier. No credit card required.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-[1.02]"
          >
            Create your account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
