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
npm run dev
```

Personal letters are stored in the current browser. Shared wishes require D1 and review configuration. Without that configuration, submissions remain pending.
