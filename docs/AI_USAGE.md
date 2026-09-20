# AI Usage Report

## Tools used

- Cursor AI (Composer) for analysis, coding, and documentation
- Allowed per assignment: AI may assist in all development steps

## What AI helped with

1. Requirement analysis from the assignment PDF
2. Database schema design (`profiles`, `machines`, `alarms`, `maintenance_records`)
3. Next.js + Tailwind UI for Login, Dashboard, Machines, Alarms, Maintenance
4. Supabase Auth + role-based access (Admin / Technician)
5. Input validation and search/filter
6. GitHub Actions CI workflow
7. README and setup instructions

## What was verified manually (student responsibility)

- Functional correctness of CRUD and roles
- Secrets not committed (only `NEXT_PUBLIC_*` keys in env)
- CI pass/fail on GitHub
- Live deployment on Vercel after connecting Supabase

## Note

Bonus features were intentionally skipped to keep the submission simple and complete for the main 100-point requirements.
