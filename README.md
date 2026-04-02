This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Patient Realtime

`/patient` supports 2 realtime modes controlled by env:

- `NEXT_PUBLIC_PATIENT_REALTIME_MODE=auto`
  In development uses `sse`, in production uses `poll` for easier deploys on platforms that do not keep long-lived database listeners stable.
- `NEXT_PUBLIC_PATIENT_REALTIME_MODE=sse`
  Uses `PostgreSQL LISTEN/NOTIFY` through `/api/patient/stream`.
- `NEXT_PUBLIC_PATIENT_REALTIME_MODE=poll`
  Uses timed refresh only.

Recommended production default:

```bash
NEXT_PUBLIC_PATIENT_REALTIME_MODE=auto
NEXT_PUBLIC_PATIENT_POLL_INTERVAL_MS=30000
DB_POOL_MAX=10
DB_SSL=true
```

If you deploy to a long-lived Node server and want push updates, keep `sse` enabled and make sure `supabase/initdb/002-patient-grid-realtime.sql` is applied.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
