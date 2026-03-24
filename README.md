# March Madness 2026 — Bracket Odds Tracker

A public-facing analytics dashboard for a private bracket pool. Tracks every entry's win probability, rooting recommendations, and scenario analysis as the tournament progresses.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev
# → Open http://localhost:3000
```

---

## How to Update Results

Edit **`src/data/results.ts`**. Add one line per completed game:

```ts
export const RESULTS: Results = {
  "s16-east-1": "duke",         // Duke beat St. John's
  "s16-east-2": "uconn",        // UConn beat Michigan State
  "s16-south-1": "iowa",        // Iowa beat Nebraska
  // ... add games as they finish
};
```

Save the file. In local dev the page reloads automatically. On Vercel, commit + push triggers a ~30-second redeploy.

### Game IDs

| Game ID | Matchup | Points |
|---|---|---|
| `s16-east-1` | Duke vs St. John's (Sweet 16) | 4 |
| `s16-east-2` | Michigan State vs UConn (Sweet 16) | 4 |
| `s16-south-1` | Iowa vs Nebraska (Sweet 16) | 4 |
| `s16-south-2` | Illinois vs Houston (Sweet 16) | 4 |
| `s16-west-1` | Arizona vs Arkansas (Sweet 16) | 4 |
| `s16-west-2` | Texas vs Purdue (Sweet 16) | 4 |
| `s16-midwest-1` | Michigan vs Alabama (Sweet 16) | 4 |
| `s16-midwest-2` | Tennessee vs Iowa State (Sweet 16) | 4 |
| `e8-east` | East Regional Final (Elite 8) | 8 |
| `e8-south` | South Regional Final (Elite 8) | 8 |
| `e8-west` | West Regional Final (Elite 8) | 8 |
| `e8-midwest` | Midwest Regional Final (Elite 8) | 8 |
| `ff-1` | Final Four: East vs South | 16 |
| `ff-2` | Final Four: West vs Midwest | 16 |
| `championship` | National Championship | 32 |

### Team IDs

| Team | ID |
|---|---|
| Duke | `duke` |
| St. John's | `stjohns` |
| Michigan State | `michiganstate` |
| UConn | `uconn` |
| Iowa | `iowa` |
| Nebraska | `nebraska` |
| Illinois | `illinois` |
| Houston | `houston` |
| Arizona | `arizona` |
| Arkansas | `arkansas` |
| Texas | `texas` |
| Purdue | `purdue` |
| Michigan | `michigan` |
| Alabama | `alabama` |
| Tennessee | `tennessee` |
| Iowa State | `iowastate` |

---

## How to Add / Edit Bracket Entries

Edit **`src/data/entries.ts`**. Each entry needs:
- a unique `id` (lowercase, no spaces)
- a `displayName`
- a `picks` object mapping every game ID to a team ID

```ts
{
  id: "yourname",
  displayName: "Your Name",
  picks: {
    "s16-east-1": "duke",
    "s16-east-2": "uconn",
    "e8-east": "duke",
    "s16-south-1": "iowa",
    "s16-south-2": "houston",
    "e8-south": "houston",
    "s16-west-1": "arizona",
    "s16-west-2": "texas",
    "e8-west": "arizona",
    "s16-midwest-1": "alabama",
    "s16-midwest-2": "tennessee",
    "e8-midwest": "tennessee",
    "ff-1": "duke",
    "ff-2": "arizona",
    championship: "duke",
  },
},
```

---

## How Probabilities Are Computed

All probabilities are **exact** — not simulated.

1. Every remaining game is expanded recursively. With `N` remaining games there are `2^N` possible tournament completions.
2. All outcomes are assumed equally likely (50/50 per game).
3. For each complete outcome, every entry's final score is computed based on their picks.
4. An entry "wins" an outcome if their score equals the maximum score in that outcome. Ties are supported — if two entries share the top score, each gets a tie-for-first credit.
5. Probabilities are counts divided by total outcomes:
   - **Solo win %** = outcomes where entry is sole leader / total outcomes
   - **Win or tie %** = outcomes where entry is at or tied for first / total outcomes

Max possible score: sum of points for all remaining picks that can still happen (the picked team hasn't been eliminated).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── standings/page.tsx    # Full standings table
│   ├── rooting/page.tsx      # Rooting matrix + per-entry detail
│   ├── scenarios/page.tsx    # Per-game outcome impact
│   └── about/page.tsx        # Methodology + how to update
├── components/
│   ├── Header.tsx
│   ├── StandingsTable.tsx    # Sortable (client component)
│   ├── RootingMatrix.tsx     # Grid (client component)
│   ├── GameCard.tsx
│   ├── ProbabilityBar.tsx
│   └── StatusBadge.tsx
├── data/
│   ├── teams.ts              # 16 Sweet 16 teams
│   ├── games.ts              # 15 remaining games + bracket tree
│   ├── entries.ts            ← EDIT THIS to add/change brackets
│   ├── results.ts            ← EDIT THIS to record game results
│   └── settings.ts           # Scoring per round
└── lib/
    ├── types.ts              # TypeScript types
    ├── bracket.ts            # Bracket helpers (reachability, participants)
    ├── scoring.ts            # Score calculation
    ├── simulation.ts         # Exact outcome enumeration + probabilities
    ├── rooting.ts            # Rooting guide + scenario deltas
    └── format.ts             # Display formatting
```

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Framework: **Next.js** (auto-detected).
4. Click Deploy. No environment variables needed.

**To update live results after deploying:**
- Edit `src/data/results.ts`
- Commit and push
- Vercel redeploys in ~30 seconds, all odds recalculate

---

## Scoring

| Round | Points |
|---|---|
| Sweet 16 correct pick | 4 |
| Elite 8 correct pick | 8 |
| Final Four correct pick | 16 |
| Championship correct pick | 32 |
| **Maximum total** | **128** |

Pool ties are allowed — if two entries finish with equal points in a scenario, both get credit for a tie-for-first outcome.
