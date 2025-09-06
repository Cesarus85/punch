# Punch-Ball

## Build & Deployment

The game runs as a static web application. To deploy, serve the repository contents with any static file server.

### Adding music tracks

Music is organised by time mode under `assets/music/<mode>` (e.g. `1_min`, `3_min`, `5_min`). Each folder contains a `manifest.json` listing the available tracks with their display name and filename. Whenever new songs are added, update the appropriate manifest file so the menu can load them.

### Calorie calculation

Calorie burn is estimated from movement speed and hits. The constants in `config.js` are calibrated for a 70&nbsp;kg player. To adapt the estimation to a different body weight, call `setUserWeight(weightInKg)` or change `USER_WEIGHT` directly in the config.

