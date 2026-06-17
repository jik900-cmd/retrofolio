# Retrofolio

Retrofolio is a hindsight investing simulator.

It lets a user choose an asset class, enter a symbol, select a past date, input an investment amount in KRW, and see what that investment would be worth now.

## Stack
- Next.js
- TypeScript
- Tailwind CSS
- Recharts

## Runtime data model
Retrofolio is now designed to be **Vercel-friendly**:
- the web app runs on Next.js
- market data is fetched directly from Yahoo chart HTTP endpoints in TypeScript server code
- runtime simulation no longer depends on local Python or FinanceDataReader execution

## Local development
```bash
npm install
npm run dev
```

Open:
- <http://localhost:3000>

## Production build check
```bash
npm run build
```

## Deploy to Vercel
This project is prepared for the standard Vercel + GitHub flow:
1. push this project to a GitHub repository
2. import the repository into Vercel
3. deploy with the default Next.js settings

No runtime Python setup is required for deployment.

## Notes
- `src/app/api/simulate` is the main simulation endpoint.
- `src/app/api/symbol-search` provides symbol lookup suggestions.
- `scripts/` contains local helper scripts and data-generation tools only; they are **not** required for production runtime.

## Known operational considerations
- market data currently depends on public Yahoo chart endpoints
- server-side Yahoo fetches now use 300s revalidation cache plus bounded retry/backoff for timeout / 429 / 5xx cases
- provider-side outages or schema changes are still a production risk
- if traffic grows further, add fallback provider logic and stronger observability

## Deployment checklist
- see `docs/VERCEL_DEPLOY_CHECKLIST.md`
