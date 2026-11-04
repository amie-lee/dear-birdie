# Dear Birdie

A little letter, carried somewhere.

A web app for focus sessions, wishes, and anonymous letters.

- **Focus** — write a task and start a focus timer.
- **Make a wish** — keep a private wish or submit it for sharing.
- **Find a letter** — discover reviewed wishes after 24 hours.
- **My letters** — revisit letters saved in your browser.

Built with React, TypeScript, Vinext, and Cloudflare D1.

## Development

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Personal letters are stored in the current browser. Shared wishes require D1 and review configuration. Without that configuration, submissions remain pending.

## Deployment

Live: https://dear-birdie.later-test-amie.workers.dev

Deploy to the configured Cloudflare Workers account and D1 database:

```sh
npx wrangler login
npm run build
npm run deploy
```

`npm run deploy` applies pending D1 migrations before deploying the build. For a different account, update `account_id` and the D1 database binding in `wrangler.jsonc`.

Public sharing requires `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, and `OPENAI_API_KEY` in the Worker environment. Set `ADMIN_TOKEN` for protected review endpoints. Keep secret values out of the repository.
