# APITrek Pro

A comprehensive API management and billing platform built with modern web technologies. APITrek Pro helps developers and teams manage their APIs, track usage, and handle billing seamlessly.

---

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

- **API Management**: Create, manage, and monitor your APIs
- **Usage Analytics**: Track API usage and generate insights
- **Billing Integration**: Integrated payment processing with Razorpay
- **User Authentication**: Secure authentication with Supabase
- **Database Management**: PostgreSQL database with migrations
- **Admin Dashboard**: Comprehensive dashboard for administrators
- **Multi-user Support**: Role-based access control
- **Email Notifications**: Automated email service with Resend

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **Git**
- **Supabase CLI** (for local development)
- **Wrangler CLI** (for Cloudflare Workers)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/apitrek-pro.git
cd apitrek-pro
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Razorpay Configuration
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Resend Configuration
RESEND_API_KEY=your_resend_api_key

# API Configuration
VITE_API_URL=http://localhost:3000
VITE_APP_URL=http://localhost:5173
```

### 4. Setup Supabase

```bash
supabase start
supabase migration up
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

---

## 📁 Project Structure

```
apitrek-pro/
├── src/
│   ├── components/           # Reusable React components
│   │   ├── ui/              # UI component library (shadcn/ui)
│   │   ├── EmptyState.tsx   # Empty state component
│   │   ├── Footer.tsx       # Footer component
│   │   ├── Navbar.tsx       # Navigation bar
│   │   ├── Sidebar.tsx      # Sidebar navigation
│   │   └── ...
│   ├── routes/              # TanStack Router pages
│   │   ├── __root.tsx       # Root layout
│   │   ├── _app.tsx         # App layout
│   │   ├── index.tsx        # Home page
│   │   ├── login.tsx        # Login page
│   │   ├── register.tsx     # Registration page
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx
│   │   ├── _app/            # Protected routes
│   │   └── api/             # API routes
│   ├── context/             # React Context providers
│   │   ├── auth.tsx         # Authentication context
│   │   └── theme.tsx        # Theme context
│   ├── hooks/               # Custom React hooks
│   │   └── use-mobile.tsx   # Mobile detection hook
│   ├── integrations/        # Third-party integrations
│   │   └── supabase/        # Supabase integration
│   ├── lib/                 # Utility functions and helpers
│   │   ├── api-key.ts       # API key management
│   │   ├── api-key-server.ts
│   │   ├── api-keys-client.ts
│   │   ├── billing.ts       # Billing utilities
│   │   ├── billing-client.ts
│   │   ├── billing-server.ts
│   │   ├── razorpay.server.ts
│   │   ├── razorpay-checkout.ts
│   │   ├── resend.server.ts # Email service
│   │   ├── supabase.ts      # Supabase client
│   │   ├── invoice-pdf.server.ts
│   │   ├── logger.ts        # Logging utility
│   │   └── utils.ts         # General utilities
│   ├── main.tsx             # Application entry point
│   ├── router.tsx           # Route configuration
│   ├── styles.css           # Global styles
│   └── routeTree.gen.ts     # Generated route tree
├── supabase/
│   ├── config.toml          # Supabase configuration
│   ├── functions/           # Edge functions
│   │   └── usage-insights/  # Usage analytics function
│   └── migrations/          # Database migrations
│       ├── 20260418*.sql    # Initial schema setup
│       ├── 20260420*.sql    # Feature additions
│       └── 20260425*.sql    # Stabilization & fixes
├── public/                  # Static assets
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── vercel.json              # Vercel deployment config
├── wrangler.jsonc           # Cloudflare Workers config
├── eslint.config.js         # ESLint configuration
├── components.json          # Shadcn/ui configuration
├── index.html               # HTML entry point
└── README.md                # This file
```

### Folder Descriptions

| Folder | Description |
|--------|-------------|
| `src/components/` | Reusable React components, including UI component library |
| `src/routes/` | Application pages and API routes using TanStack Router |
| `src/context/` | Global state management using React Context |
| `src/hooks/` | Custom React hooks for reusable logic |
| `src/integrations/` | Third-party service integrations |
| `src/lib/` | Core utilities, helpers, and business logic |
| `supabase/` | Supabase configuration, migrations, and edge functions |

---

## ⚙️ Configuration

### Environment Variables

All configuration is managed through environment variables. Create `.env.local` file with:

```env
# Frontend Environment
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=
VITE_API_URL=
VITE_APP_URL=

# Server-side Environment
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
```

### Supabase Setup

Run migrations to set up the database:

```bash
supabase migration up
```

### Wrangler Configuration

For Cloudflare Workers deployment, configure `wrangler.jsonc`:

```json
{
  "name": "apitrek-pro",
  "main": "src/index.ts",
  "env": {
    "production": {
      "routes": [
        { "pattern": "api.example.com/*", "zone_name": "example.com" }
      ]
    }
  }
}
```

---

## 💻 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Type check
npm run type-check

# Database operations
supabase start
supabase stop
supabase migration up
supabase migration down
```

### Development Workflow

1. Create a new branch for your feature
2. Make your changes
3. Run linter and type check
4. Test your changes
5. Create a pull request

### Database Migrations

Create a new migration:

```bash
supabase migration new <migration_name>
```

Edit the migration file in `supabase/migrations/` and run:

```bash
supabase migration up
```

---

## 🌐 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

```bash
vercel deploy --prod
```

### Supabase Edge Functions Deployment

```bash
supabase functions deploy usage-insights
```

### Cloudflare Workers Deployment

```bash
wrangler deploy
```

---

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset

### API Management

- `GET /api/keys` - List API keys
- `POST /api/keys` - Create new API key
- `DELETE /api/keys/:id` - Delete API key

### Billing

- `GET /api/billing/usage` - Get usage analytics
- `POST /api/billing/checkout` - Initialize Razorpay checkout
- `GET /api/billing/invoices` - List invoices
- `GET /api/billing/subscriptions` - Get subscription info

### Admin

- `GET /api/admin/users` - List all users
- `GET /api/admin/stats` - Get system statistics

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Use TypeScript for type safety
- Follow ESLint rules configured in the project
- Write meaningful commit messages
- Add comments for complex logic
- Test your changes before submitting

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📧 Support

For support, email support@apitrek.com or open an issue on GitHub.

---

## 🔗 Quick Links

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [TanStack Router](https://tanstack.com/router)
- [Razorpay API](https://razorpay.com/docs/)
- [Resend Email](https://resend.com/docs)

---

**Last Updated**: May 2026
