# D's Virtual Space – Freelance & Gig Marketplace Platform

Gig Connect is a full-stack freelance/gig marketplace connecting buyers with skilled sellers (freelancers / employees).  
Buyers post job requests → admins review & assign sellers → real-time offers & bookings.

Built with reliability and admin control in mind — stable data fetching, real-time notifications, and a powerful admin dashboard.

## Features

### Buyer
- Browse categories & seller gigs
- Submit detailed job requests (title, description, budget, preferred start/due dates)
- View personal dashboard of submitted requests

### Seller (in progress)
- Receive job assignments & offers in real-time
- Accept/reject offers
- Manage availability & gigs

### Admin Dashboard
- Manage pending job requests: view, reject, **assign sellers** (advanced modal)
- Seller assignment modal:
  - Search, sort (rating/name/availability), filter (available/high-rated)
  - Bulk assign multiple sellers
  - Optional notes/reason + custom confirmation dialog
  - Seller preview (avatar, bio, gig count, sample gigs)
- Gig approval/rejection
- Full bookings overview: filter by status, update status (complete/cancel)
- Stable UI with loading states, error handling, toasts, refresh buttons

### Backend
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Flask API with JWT auth & rate limiting
- Real-time notifications via Socket.IO
- Robust query builder with pagination & filtering

## Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (fast dev & build)
- Tailwind CSS + shadcn/ui
- Tanstack Query (data fetching, mutations, caching)
- Lucide React icons
- Sonner (toasts)
- date-fns (dates)
- framer-motion (optional animations)

**Backend**
- Python 3.11+
- Flask
- Supabase-py
- Flask-JWT-Extended
- Flask-Limiter
- Socket.IO
- Logging & structured error handling

**Database & Services**
- Supabase (PostgreSQL, Auth, Storage, Realtime)
- Redis (caching / sessions – optional)

**Tools & Dev**
- Git
- VS Code
- Node.js 20+ / npm
- Python 3.11+

## Prerequisites

- Node.js 20+ & npm (or pnpm/yarn)
- Python 3.11+
- Git
- Supabase account & project (free tier works)
- (Optional) Redis if using caching/sessions