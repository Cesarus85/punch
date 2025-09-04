// --- Core Tuning ---
export const BALL_RADIUS = 0.12;
export const FIST_RADIUS = 0.11;
export const SPAWN_DISTANCE = 2.5;      // m vor initialer Blickrichtung
export const SIDE_OFFSET = 0.5;         // m links/rechts (normal)
export const SIDE_OFFSET_TIGHT = 0.25;  // m links/rechts (eng)
export const TIGHT_PROB = 0.45;         // Wahrscheinlichkeit für "eng"
export const BALL_SPEED = 1.6;          // m/s
export const SPAWN_INTERVAL = 0.65;     // s
export const SPAWN_MAX_BELOW = 0.70;    // m (max. 70 cm unter Headset)
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

// --- Drift (Step 3) ---
export const DRIFT_ENABLED = true;
export const DRIFT_MIN_AMPLITUDE = 0.08; // m
export const DRIFT_MAX_AMPLITUDE = 0.22; // m
export const DRIFT_MIN_FREQ = 0.8;       // Hz
export const DRIFT_MAX_FREQ = 1.6;       // Hz

// --- Audio/Haptics ---
export const AUDIO_ENABLED = true;
export const HAPTICS_ENABLED = true;

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
export const GAME_MODE = 'endless';           // 'endless' | 'sprint60'
export const SPRINT_DURATION = 60;            // Sekunden
export const COMBO_STEP = 5;                  // alle 5 Treffer +1 Multiplikator
export const COMBO_MAX_MULT = 5;              // max. x5
