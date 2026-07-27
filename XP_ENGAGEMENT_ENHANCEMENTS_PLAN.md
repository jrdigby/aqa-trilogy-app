# XP Engagement Enhancements

> Status: Interactive choose-your-destination journey implemented (Jul 2026).

## Interactive Science Journey (current)

- **24 cities** worldwide with calibrated `mapX`/`mapY` on `images/world-map.svg`
- Student **chooses next destination**; travel cost = haversine km; budget = total XP − distance already travelled
- **Hover** a city → scientist overlay; **click** visited city → passport/detail; **click** reachable city → travel
- Passport unlocks by **visited cities** (London starts unlocked)
- Progress bars vs **20,000 km (half)** and **40,000 km (full)** world
- Representation: **75% women**, **5 African cities** (Cairo, Accra, Lagos, Nairobi, Cape Town)

Key files: `src/journeyLocations.js`, `src/journeyMap.js`, `src/journeyScientists.js`, Science Journey dashboard tab.
