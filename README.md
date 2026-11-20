# InterviewPrep

## Local Development

Start the local Supabase stack, then launch Next.js with its local API and
public key injected in memory:

```bash
npx supabase start
npm run dev:local
```

Stop any existing `next dev` process for this repository before starting
`dev:local`.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Use another port with
`npm run dev:local -- --port 3100`.

`dev:local` refuses non-loopback Supabase URLs and hostname overrides. Its
process environment takes precedence over existing development configuration;
it does not read or modify `.env.local`. Only the local public/anon key is
provided to Next.js. The command does not link, migrate, or modify any cloud
project.

Stop Next.js with `Ctrl+C`. Stop the local Supabase containers when finished:

```bash
npx supabase stop
```
