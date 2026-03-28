# VEMIO™ | Network Intelligence Dashboard

Managed network intelligence platform by **Vinay Enterprises**.

Customer-facing dashboard showing real-time device health, uptime metrics, SLA compliance, and incident tracking — powered by Auvik webhooks and PostgreSQL.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Auth:** NextAuth.js with credentials provider + tenant-scoped JWT
- **Database:** PostgreSQL 16 via PgBouncer (DigitalOcean VPS)
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Deployment:** Vercel (bom1 region)
- **Domain:** vemio.vinayenterprises.co.in

## Quick Start

```bash
# Clone
git clone https://github.com/VinayEnterprises/vemio-dashboard.git
cd vemio-dashboard

# Install
pnpm install

# Configure
cp .env.example .env.local
# Edit .env.local with your database URL and secrets

# Run
pnpm dev
```

## Project Structure

```
app/
├── (auth)/login/           # Login page (unprotected)
├── (dashboard)/            # Dashboard shell (protected)
│   ├── overview/           # Overview tab
│   ├── devices/            # Device Health tab (Phase 2)
│   └── tickets/            # Tickets & SLA tab (Phase 3)
├── api/
│   ├── auth/[...nextauth]/ # NextAuth.js handlers
│   ├── webhooks/auvik/     # Auvik webhook receiver
│   ├── overview/           # Dashboard overview data
│   └── health/             # Health check endpoint
├── components/
│   ├── auth/               # Auth providers
│   ├── dashboard/          # Dashboard widgets
│   └── layout/             # Sidebar, header
lib/
├── db.js                   # PostgreSQL connection pool + tenant scoping
└── auth.js                 # Auth helpers (requireAuth, withAuth)
```

## Webhook Endpoint

```
POST https://vemio.vinayenterprises.co.in/api/webhooks/auvik
```

Configure in Auvik dashboard with HMAC-SHA256 secret matching `AUVIK_WEBHOOK_SECRET`.

## Vercel Deployment

1. Import repository in Vercel
2. Set environment variables (see `.env.example`)
3. Deploy
4. Add custom domain: `vemio.vinayenterprises.co.in`
5. Configure DNS: `CNAME → cname.vercel-dns.com`

## Database Roles

- **vemio_api** — Used by Next.js API routes. RLS enforced (tenant-scoped).
- **vemio_worker** — Used by background workers. Bypasses RLS.

---

*Vinay Enterprises · Est. 1992 · Ahmedabad, Gujarat*
