# Diet Tracker

A phone-first checklist for a daily diet plan: tick foods as you eat them, adjust anything for the day, and see how far you are from your calorie and macro goals.

## Develop

```bash
npm install
npm run dev     # local dev server
npm test        # unit and component tests
npm run lint
npm run build   # type-check + production build
```

## Install on your phone

The app is published to GitHub Pages at `https://vincearrage.github.io/DietTracker/`.

- **iPhone (Safari):** open the link → Share → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Install app**.

It works offline once installed. Food search needs a connection.

## Your data

Everything stays on your phone (IndexedDB). Use **Settings → Export backup** now and then; **Import backup** restores it. iOS can clear website data for apps you haven't opened in a few weeks, so installing to the home screen and keeping a backup is worth it.

## Food search

Searches USDA FoodData Central (and Open Food Facts, when the browser allows it). USDA's shared demo key is rate-limited; get a free key at https://fdc.nal.usda.gov/api-key-signup and paste it in **Settings**.
