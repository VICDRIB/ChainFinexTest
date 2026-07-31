# ChainFinex

A financial dashboard web app with plain HTML/CSS/JS frontend, Node.js/Express backend, and Supabase database.

## Quick Start

```bash
npm install
# or
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required:
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase service role key

Optional (for email notifications):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` — SMTP config
- `EMAIL_FROM` — Sender name/address
- `ADMIN_EMAIL` — Admin email to receive alerts
- `APP_URL` — Your app's URL (used in email links)

### Gmail Setup
1. Enable 2FA on your Google account
2. Create an App Password: Google Account → Security → 2-Step Verification → App passwords
3. Use `smtp.gmail.com`, port `587`, and your App Password

## Supabase Schema

**Important:** Before using the app, run the SQL in `SUPABASE_SCHEMA.sql` in your Supabase SQL Editor.

New tables/columns required:
- `notifications` table (for in-app notifications)
- `decline_reason` column on `withdrawals`
- `reject_reason` column on `pending_payments`

## Features

### User Features
- **Dashboard** — Account overview, active plans, transaction history
- **Deposit** — Multi-step deposit flow with crypto payment methods
- **Withdraw** — New withdrawal page with coin selector, wallet input
- **Withdrawal History** — Shows all statuses: pending/approved/declined with reasons
- **Deposit History** — Shows pending and completed deposits
- **Notifications** — All activity notifications; click to navigate to relevant page
- **Transactions** — Full history with type filter and search
- **Swap** — Convert between crypto and main balance
- **Trading Plans** — Browse and invest in plans
- **My Plans** — Active and completed investments
- **Referral** — Referral program with bonus tracking
- **Profile** — Edit personal information
- **Security** — Change password and withdrawal password

### Admin Features
- **User Management** — View all users, adjust balances, view full user history
- **Activity Log** — Real-time log with location, IP, event type filtering
- **Pending Deposits** — Approve or reject with reason (user notified)
- **Withdrawal Management** — Approve or decline with reason (user notified)
- **Payment Addresses** — Set crypto wallet addresses for deposits
- **Investments** — Manage user investment plans, pay daily profits

### Email Notifications
Emails are sent for:
- Login (user + admin)
- Account registration (user + admin)
- Deposit submitted (user + admin)
- Deposit approved/rejected (user)
- Withdrawal submitted (user + admin)
- Withdrawal approved/declined (user)
- Swap completed (user)
- Profile updated (user)
- Password changed (user)
- Withdrawal password set/changed (user)

### In-App Notifications
Notifications are shown for all the above events. Users can:
- See unread count badge on the notifications nav link and header bell
- Click notifications to navigate to the relevant page
- Mark all as read

## Stack
- **Backend:** Node.js, Express
- **Database:** Supabase (PostgreSQL)
- **Email:** Nodemailer
- **Frontend:** Vanilla JS (ES modules), HTML, CSS
- **Auth:** bcryptjs + express-session
