# Punch-Ball

## Build & Deployment

The game runs as a static web application. To deploy, serve the repository contents with any static file server.

### Adding music tracks

Music is organised by time mode under `assets/music/<mode>` (e.g. `1_min`, `3_min`, `5_min`). Each folder contains a `manifest.json` listing the available tracks with their display name and filename. Whenever new songs are added, update the appropriate manifest file so the menu can load them.

