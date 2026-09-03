---
name: Vercel branch URLs
description: Deployment URL policy for Vercel branch environments.
---

Vercel branch deployments must be able to start without a manually configured custom domain. Main, develop, and feature deployments use Vercel’s automatic HTTPS URLs; `NEXT_PUBLIC_APP_URL` is optional and only validated when explicitly supplied.

**Why:** The project does not currently own or use a custom production domain, and requiring one makes otherwise healthy Vercel deployments fail during server startup.

**How to apply:** Keep application links relative where possible. If a future custom domain is introduced, configure and validate `NEXT_PUBLIC_APP_URL` for that environment without making it a prerequisite for branch previews.