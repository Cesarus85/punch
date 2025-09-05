// --- Core Tuning ---
export const BALL_RADIUS = 0.12;
export const FIST_RADIUS = 0.11;
export const SPAWN_DISTANCE = 2.5;      // m vor initialer Blickrichtung
export const SIDE_OFFSET = 0.5;         // m links/rechts (normal)
export const SIDE_OFFSET_TIGHT = 0.25;  // m links/rechts (eng)
export const TIGHT_PROB = 0.45;         // Wahrscheinlichkeit für "eng"
export const BALL_SPEED = 1.6;          // m/s
export const SPAWN_INTERVAL = 0.65;     // s
// --- Beat / Rhythm ---
export const DEFAULT_BPM = 92;
export let BPM = DEFAULT_BPM;
export let BEAT_DURATION = 60 / BPM;            // Sekunden pro Beat
export let HALF_BEAT_DURATION = BEAT_DURATION / 2;
export let QUARTER_BEAT_DURATION = BEAT_DURATION / 4;
export function setBpm(bpm){
  BPM = bpm;
  BEAT_DURATION = 60 / bpm;
  HALF_BEAT_DURATION = BEAT_DURATION / 2;
  QUARTER_BEAT_DURATION = BEAT_DURATION / 4;
}
export let BEAT_SNAP_ENABLED = true;
export function setBeatSnapEnabled(v){ BEAT_SNAP_ENABLED = !!v; }
// Dynamische Spawn-Höhe basierend auf Körpergröße (z.B. Brusthöhe ~60 %)
export const SPAWN_HEIGHT_RATIO = 0.6;  // Anteil der Körperhöhe für Spawns
export const MISS_PLANE_OFFSET = 0.02;  // m vor der initialen Ebene
export const SPAWN_BIAS = 0.20;         // m (20 cm näher zu dir, reduziert Wand-Occlusion)
export const MIN_SPAWN_DISTANCE = 0.35; // m Mindestabstand zwischen Spawns

// --- HUD ---
export const HUD_FORWARD = 1.0;         // m vor initialer Position
export const HUD_RIGHT = -0.05;         // m nach links (5 cm)
export const HUD_TILT_DEG = 20;         // Grad Neigung nach oben
export const HUD_PLANE_W = 0.50;
export const HUD_PLANE_H = 0.25;        // Unterkante auf Boden (Center = H/2)

// --- Assets ---
export const BALL_URL = './assets/ball.glb';
export const HAZARD_URL = './assets/hantel.glb';

// --- Drift (Step 3) ---
export const DRIFT_ENABLED = true;
export const DRIFT_MIN_AMPLITUDE = 0.08; // m
export const DRIFT_MAX_AMPLITUDE = 0.22; // m
export const DRIFT_MIN_FREQ = 0.8;       // Hz
export const DRIFT_MAX_FREQ = 1.6;       // Hz

// --- Audio/Haptics ---
export const AUDIO_ENABLED = true;
export const HAPTICS_ENABLED = true;
export let MUSIC_ENABLED = true;
export function setMusicEnabled(v){ MUSIC_ENABLED = !!v; }

// --- Effects ---
export const DISSOLVE_DURATION = 0.4;  // s
export const HIT_PARTICLE_COUNT = 80;

// --- Hazards (Step 4) ---
export const HAZARD_ENABLED = true;
export const HAZARD_PROB = 0.25;              // gern wieder auf 0.25 setzen
export const FORCE_HAZARD_EVERY_N = 0;        // 0 = aus; z.B. jeder 3. Spawn garantiert Hazard
export const HAZARD_RADIUS = 0.14;
export const HAZARD_SPEED = BALL_SPEED;
export const HAZARD_PENALTY = 2;
export const HAZARD_COLOR = 0xff4242;
export const HAZARD_EMISSIVE_INTENSITY = 0.9; // damit Hazards „leuchten“ und immer sichtbar sind
// Kurzer, starker Rumble bei Hazard-Treffern
export const HAZARD_RUMBLE_INTENSITY = 1.0;   // volle Intensität
export const HAZARD_RUMBLE_DURATION = 55;     // ms, kurz und kräftig

// --- Debug ---
export const DEBUG_HAZARD_RING_MS = 0;      // 0 = aus; kurzer Ring-Flash am Hazard-Spawn

// --- Game Modes ---
export const GAME_MODE = 'time60';            // 'time60' | 'time180' | 'time300'
export const SPRINT_DURATION = 60;            // Sekunden
export const COMBO_STEP = 5;                  // alle 5 Treffer +1 Multiplikator
export const COMBO_MAX_MULT = 5;              // max. x5

// --- Player Body Configuration ---
export let BODY_HEIGHT = 1.75;                // default body height in meters
export let SHOULDER_WIDTH = 0.47;             // default shoulder width in meters
export let BODY_CAPSULE_HEIGHT = 1.10;        // used for hazard collision (head to hip)
// Reduced radius to delay hazard collisions until actual body contact (~15 cm less)
export let BODY_CAPSULE_RADIUS = 0.13;        // half of default shoulder width minus 0.15 m

export function setBodyConfig({ height, shoulderWidth } = {}) {
  if (typeof height === 'number' && height > 0) {
    BODY_HEIGHT = height;
    BODY_CAPSULE_HEIGHT = height;
  }
  if (typeof shoulderWidth === 'number' && shoulderWidth > 0) {
    SHOULDER_WIDTH = shoulderWidth;
    // Use shoulder width with a 0.15 m inward offset, ensure radius stays positive
    BODY_CAPSULE_RADIUS = Math.max((shoulderWidth / 2) - 0.15, 0.01);
  }
}

// --- Floor Offset & Spawn Utilities ---
// Gemessene Kopf-/Bodenhöhe (wird beim Setup aktualisiert)
export let FLOOR_OFFSET = BODY_HEIGHT;

export function setFloorOffset(offset) {
  if (typeof offset === 'number' && offset > 0) {
    FLOOR_OFFSET = offset;
    BODY_HEIGHT = offset; // absolute Körpergröße merken
  }
}

export function getSpawnMaxBelow() {
  // Differenz zwischen Kopf und gewünschter Spawn-Höhe
  return FLOOR_OFFSET * (1 - SPAWN_HEIGHT_RATIO);
}
