// Zentrale Tuning-Parameter
export const BALL_RADIUS = 0.12;
export const FIST_RADIUS = 0.11;
export const SPAWN_DISTANCE = 2.5;      // m vor initialer Blickrichtung
export const SIDE_OFFSET = 0.5;         // m links/rechts (normal)
export const SIDE_OFFSET_TIGHT = 0.25;  // m links/rechts (eng)
export const TIGHT_PROB = 0.45;         // Wahrscheinlichkeit für "eng"
export const BALL_SPEED = 1.6;          // m/s
export const SPAWN_INTERVAL = 0.65;     // s
export const PUNCH_SPEED = 0.6;         // m/s Mindestgeschwindigkeit der Faust
export const SPAWN_MAX_BELOW = 0.70;    // m (max. 70 cm unter Headset)
export const MISS_PLANE_OFFSET = 0.02;  // m vor der initialen Ebene
export const HUD_FORWARD = 1.0;         // m vor initialer Position
export const HUD_RIGHT = 0.10;          // m nach rechts (10 cm)
export const HUD_TILT_DEG = 20;         // Grad Neigung nach oben
export const HUD_PLANE_W = 0.50;
export const HUD_PLANE_H = 0.25;        // Unterkante auf Boden (Center = H/2)
export const BALL_URL = './assets/ball.glb';

// Schritt 3 – neue Optionen
export const DRIFT_ENABLED = true;
export const DRIFT_MIN_AMPLITUDE = 0.08;  // m (seitlich)
export const DRIFT_MAX_AMPLITUDE = 0.22;  // m
export const DRIFT_MIN_FREQ = 0.8;        // Hz
export const DRIFT_MAX_FREQ = 1.6;        // Hz

export const AUDIO_ENABLED = true;
export const HAPTICS_ENABLED = true;

// Optional: kleiner Spawn-Bias reduziert Occlusion an Wänden
export const SPAWN_BIAS = 0.20; // m
