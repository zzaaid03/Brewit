# Brewit

Brewit is a manual coffee recipe generator focused on pourover workflows.
You provide bean profile + taste goal, and it returns a tuned recipe with:

- adjusted ratio and temperature
- timed pour schedule
- troubleshooting advice
- public coffee inspiration cards (TheMealDB)

## Stack

- React 19
- TypeScript
- Vite 8

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## MVP implemented

- Recipe inputs: method, origin, process, roast, taste goal, dose, ratio, temperature
- Rule-based recipe engine in `src/lib/brewEngine.ts`
- Generated brew plan with method-specific pour steps
- Taste troubleshooting section
- Free public API integration from TheMealDB:
  - `https://www.themealdb.com/api/json/v1/1/search.php?s=coffee`

## Next ideas

- Save brew history with cup ratings
- Add grinder-specific adjustment presets
- Add authentication and personal recipe profiles
