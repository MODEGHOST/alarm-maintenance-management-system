# Alarm & Maintenance Management System

Web application for factory automation: manage machines, alarm records, and maintenance work.

## Objectives

Support Automation / plant operations with:

- Authentication and role-based access (Admin, Technician)
- Machine master data (CRUD)
- Alarm records (Create / Read / Update)
- Maintenance records (Create / Read / Update)
- Search / filter, dashboard summary, and input validation

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- GitHub + GitHub Actions (CI)
- Vercel (Deployment)
- AI-assisted development (Cursor / ChatGPT)

## Main Features

| Module | Capability |
|--------|------------|
| Auth | Login / Logout with Supabase Auth |
| Roles | Admin: full machine control; Technician: view machines, manage alarms & maintenance, use dashboard |
| Machines | CRUD + status: Running / Stop / Alarm / Maintenance |
| Alarms | Create / Read / Update + status: Open / In Progress / Closed |
| Maintenance | Create / Read / Update |
| Search / Filter | At least Machine + Status on list pages |
| Dashboard | Counts for machines by status, alarms, and maintenance |
| Validation | Required fields, unique Machine ID, error messages |

## Database Structure

Tables (see `supabase/schema.sql`):

- `profiles` — linked to `auth.users`, stores `role` (`admin` | `technician`)
- `machines` — machine master
- `alarms` — alarm records (FK → machines, profiles)
- `maintenance_records` — maintenance work (FK → machines, profiles)

Relationships:

```
auth.users 1─1 profiles
machines 1─* alarms
machines 1─* maintenance_records
profiles 1─* alarms (created_by)
profiles 1─* maintenance_records (technician_id)
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/MODEGHOST/alarm-maintenance-management-system.git
cd alarm-maintenance-management-system
npm install
```

### 2. Create Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the full script in `supabase/schema.sql`
3. Copy **Project URL** and **anon public** key from Project Settings → API

### 3. Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Do not** put Service Role Key in the client app or commit secrets to GitHub.

### 4. Create users (Admin / Technician)

In Supabase **Authentication → Users → Add user**:

1. Create Admin user (email + password)
2. Create Technician user (email + password)

Then in **Table Editor → profiles**, set:

- Admin row → `role = admin`
- Technician row → `role = technician`

(If the trigger created profiles automatically after signup, just update the role.)

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## GitHub Actions (CI)

Workflow: `.github/workflows/ci.yml`

On every push / pull request to `main`:

1. Install Dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Build Project (`npm run build`)

## Vercel Deployment

1. Import this GitHub repository in Vercel
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

**Vercel URL:** _(add after deploy)_  
`https://YOUR-PROJECT.vercel.app`

## Project Links

- **GitHub:** https://github.com/MODEGHOST/alarm-maintenance-management-system
- **Vercel:** _(pending)_
- **Supabase schema:** `supabase/schema.sql`

## AI Usage Summary

AI (Cursor) was used to:

- Analyze assignment requirements
- Design Supabase schema and RLS policies
- Generate Next.js app structure, UI pages, and validation
- Create GitHub Actions CI workflow and README
- Debug build / TypeScript issues during development

Human responsibility: verify correctness, configure Supabase/Vercel secrets safely, and test end-to-end before submission.

See also: `docs/AI_USAGE.md`
