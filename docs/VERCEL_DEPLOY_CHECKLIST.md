# Retrofolio Vercel Deploy Checklist

## Pre-deploy
- [ ] `npm install`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `/api/simulate` manual smoke test for:
  - [ ] KR stock
  - [ ] US stock
  - [ ] crypto
- [ ] verify old/pre-listing date returns `EARLIER_THAN_AVAILABLE_HISTORY`
- [ ] verify invalid symbol returns `INVALID_SYMBOL`

## Runtime hardening expectations
- [ ] Yahoo requests use server-side cache revalidation (300s)
- [ ] Yahoo requests retry up to 3 attempts on timeout / 429 / 5xx
- [ ] timeout is bounded so serverless functions do not hang indefinitely
- [ ] provider failure returns structured error code and retryability metadata
- [ ] API route runs on Node runtime (`runtime = nodejs`)

## Vercel project settings
- [ ] framework preset = Next.js
- [ ] root directory = `launchthon/retrofolio` if deploying from monorepo root
- [ ] production branch configured correctly
- [ ] no Python runtime dependency configured
- [ ] no server-only secrets accidentally exposed to client env vars

## Post-deploy smoke checks
- [ ] homepage loads normally
- [ ] symbol search works
- [ ] simulate request returns success for a KR stock
- [ ] simulate request returns success for a US stock
- [ ] simulate request returns success for a crypto asset
- [ ] provider-throttle or failure path returns friendly structured error JSON

## Operational follow-ups
- [ ] add lightweight request logging / observability if public traffic starts rising
- [ ] consider fallback provider strategy for Yahoo outages
- [ ] consider external cache / edge cache if traffic grows materially
- [ ] consider rate limiting on public endpoint if abuse appears
