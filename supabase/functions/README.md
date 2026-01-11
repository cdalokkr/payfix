# Supabase Edge Functions

This directory contains Supabase Edge Functions for performance-critical operations.

## Functions

| Function | Description |
|----------|-------------|
| `attendance-clock` | Fast clock-in/clock-out operations |
| `broadcast-notification` | Real-time notification broadcasting |
| `attendance-stats` | Cached attendance statistics |

## Development

```bash
# Serve locally
supabase functions serve

# Deploy all
supabase functions deploy

# Deploy specific function
supabase functions deploy attendance-clock
```

## Environment Variables

Required in Supabase Dashboard → Edge Functions → Secrets:

- `SUPABASE_URL` (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)
