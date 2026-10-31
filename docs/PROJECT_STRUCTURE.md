# Project Structure

## Overview

Meme Capsule is a minimalist curated meme PWA built with Vite + React + TypeScript and deployed on Cloudflare Pages. The backend uses Cloudflare R2 (file storage) and D1 (SQLite database) — all on one platform with zero external vendor dependencies.

**Source Code:** [https://github.com/editorav010-dev/Meme-Capsule](https://github.com/editorav010-dev/Meme-Capsule)

## Directory Map

<!-- DIRECTORY_MAP_START -->
```
meme application/
├── .agents
│   └── skills
│       └── brag
│           ├── assets
│           │   ├── music
│           │   │   ├── cues
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json
│           │   │   │   └── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md
│           │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
│           │   │   └── README.md                     # Project overview and setup guide
│           │   └── sfx
│           │       ├── casino
│           │       │   ├── card-fan-1.ogg
│           │       │   ├── card-fan-2.ogg
│           │       │   ├── card-place-1.ogg
│           │       │   ├── card-place-2.ogg
│           │       │   ├── card-place-3.ogg
│           │       │   ├── card-place-4.ogg
│           │       │   ├── card-shove-1.ogg
│           │       │   ├── card-shove-2.ogg
│           │       │   ├── card-shove-3.ogg
│           │       │   ├── card-shove-4.ogg
│           │       │   ├── card-shuffle.ogg
│           │       │   ├── card-slide-1.ogg
│           │       │   ├── card-slide-2.ogg
│           │       │   ├── card-slide-3.ogg
│           │       │   ├── card-slide-4.ogg
│           │       │   ├── card-slide-5.ogg
│           │       │   ├── card-slide-6.ogg
│           │       │   ├── card-slide-7.ogg
│           │       │   ├── card-slide-8.ogg
│           │       │   ├── cards-pack-open-1.ogg
│           │       │   ├── cards-pack-open-2.ogg
│           │       │   ├── chip-lay-1.ogg
│           │       │   ├── chip-lay-2.ogg
│           │       │   ├── chip-lay-3.ogg
│           │       │   ├── chips-collide-1.ogg
│           │       │   ├── chips-collide-2.ogg
│           │       │   ├── chips-collide-3.ogg
│           │       │   ├── chips-collide-4.ogg
│           │       │   ├── chips-handle-1.ogg
│           │       │   ├── chips-handle-2.ogg
│           │       │   ├── chips-handle-3.ogg
│           │       │   ├── chips-handle-4.ogg
│           │       │   ├── chips-handle-6.ogg
│           │       │   ├── chips-stack-1.ogg
│           │       │   ├── chips-stack-2.ogg
│           │       │   ├── chips-stack-3.ogg
│           │       │   ├── chips-stack-4.ogg
│           │       │   ├── chips-stack-5.ogg
│           │       │   ├── chips-stack-6.ogg
│           │       │   ├── dice-grab-1.ogg
│           │       │   ├── dice-grab-2.ogg
│           │       │   ├── dice-shake-1.ogg
│           │       │   ├── dice-shake-2.ogg
│           │       │   ├── dice-shake-3.ogg
│           │       │   ├── dice-throw-1.ogg
│           │       │   ├── dice-throw-2.ogg
│           │       │   ├── dice-throw-3.ogg
│           │       │   ├── die-throw-1.ogg
│           │       │   ├── die-throw-2.ogg
│           │       │   ├── die-throw-3.ogg
│           │       │   └── die-throw-4.ogg
│           │       ├── impact
│           │       │   ├── footstep_carpet_000.ogg
│           │       │   ├── footstep_carpet_003.ogg
│           │       │   ├── footstep_carpet_004.ogg
│           │       │   ├── footstep_concrete_000.ogg
│           │       │   ├── footstep_concrete_001.ogg
│           │       │   ├── footstep_concrete_002.ogg
│           │       │   ├── footstep_concrete_003.ogg
│           │       │   ├── footstep_concrete_004.ogg
│           │       │   ├── footstep_grass_000.ogg
│           │       │   ├── footstep_grass_001.ogg
│           │       │   ├── footstep_grass_002.ogg
│           │       │   ├── footstep_grass_003.ogg
│           │       │   ├── footstep_grass_004.ogg
│           │       │   ├── footstep_snow_000.ogg
│           │       │   ├── footstep_snow_001.ogg
│           │       │   ├── footstep_snow_002.ogg
│           │       │   ├── footstep_snow_003.ogg
│           │       │   ├── footstep_snow_004.ogg
│           │       │   ├── footstep_wood_000.ogg
│           │       │   ├── footstep_wood_001.ogg
│           │       │   ├── footstep_wood_002.ogg
│           │       │   ├── footstep_wood_003.ogg
│           │       │   ├── footstep_wood_004.ogg
│           │       │   ├── impactBell_heavy_000.ogg
│           │       │   ├── impactBell_heavy_003.ogg
│           │       │   ├── impactBell_heavy_004.ogg
│           │       │   ├── impactGeneric_light_000.ogg
│           │       │   ├── impactGeneric_light_001.ogg
│           │       │   ├── impactGeneric_light_002.ogg
│           │       │   ├── impactGeneric_light_003.ogg
│           │       │   ├── impactGeneric_light_004.ogg
│           │       │   ├── impactGlass_heavy_002.ogg
│           │       │   ├── impactGlass_light_001.ogg
│           │       │   ├── impactGlass_light_002.ogg
│           │       │   ├── impactGlass_light_003.ogg
│           │       │   ├── impactGlass_medium_000.ogg
│           │       │   ├── impactGlass_medium_002.ogg
│           │       │   ├── impactGlass_medium_004.ogg
│           │       │   ├── impactMetal_heavy_000.ogg
│           │       │   ├── impactMetal_heavy_002.ogg
│           │       │   ├── impactMetal_heavy_004.ogg
│           │       │   ├── impactMetal_light_002.ogg
│           │       │   ├── impactMetal_light_003.ogg
│           │       │   ├── impactMetal_medium_000.ogg
│           │       │   ├── impactMetal_medium_001.ogg
│           │       │   ├── impactMetal_medium_002.ogg
│           │       │   ├── impactMetal_medium_003.ogg
│           │       │   ├── impactMetal_medium_004.ogg
│           │       │   ├── impactMining_001.ogg
│           │       │   ├── impactPlank_medium_000.ogg
│           │       │   ├── impactPlank_medium_001.ogg
│           │       │   ├── impactPlank_medium_002.ogg
│           │       │   ├── impactPlank_medium_003.ogg
│           │       │   ├── impactPlank_medium_004.ogg
│           │       │   ├── impactPlate_heavy_000.ogg
│           │       │   ├── impactPlate_heavy_001.ogg
│           │       │   ├── impactPlate_heavy_002.ogg
│           │       │   ├── impactPlate_heavy_003.ogg
│           │       │   ├── impactPlate_heavy_004.ogg
│           │       │   ├── impactPlate_light_000.ogg
│           │       │   ├── impactPlate_light_001.ogg
│           │       │   ├── impactPlate_light_002.ogg
│           │       │   ├── impactPlate_light_003.ogg
│           │       │   ├── impactPlate_light_004.ogg
│           │       │   ├── impactPlate_medium_000.ogg
│           │       │   ├── impactPlate_medium_001.ogg
│           │       │   ├── impactPlate_medium_002.ogg
│           │       │   ├── impactPlate_medium_003.ogg
│           │       │   ├── impactPlate_medium_004.ogg
│           │       │   ├── impactPunch_heavy_000.ogg
│           │       │   ├── impactPunch_heavy_001.ogg
│           │       │   ├── impactPunch_heavy_002.ogg
│           │       │   ├── impactPunch_heavy_003.ogg
│           │       │   ├── impactPunch_heavy_004.ogg
│           │       │   ├── impactPunch_medium_000.ogg
│           │       │   ├── impactPunch_medium_001.ogg
│           │       │   ├── impactPunch_medium_002.ogg
│           │       │   ├── impactPunch_medium_003.ogg
│           │       │   ├── impactPunch_medium_004.ogg
│           │       │   ├── impactSoft_heavy_000.ogg
│           │       │   ├── impactSoft_heavy_001.ogg
│           │       │   ├── impactSoft_heavy_002.ogg
│           │       │   ├── impactSoft_heavy_003.ogg
│           │       │   ├── impactSoft_heavy_004.ogg
│           │       │   ├── impactSoft_medium_000.ogg
│           │       │   ├── impactSoft_medium_001.ogg
│           │       │   ├── impactSoft_medium_002.ogg
│           │       │   ├── impactSoft_medium_003.ogg
│           │       │   ├── impactSoft_medium_004.ogg
│           │       │   ├── impactTin_medium_000.ogg
│           │       │   ├── impactTin_medium_001.ogg
│           │       │   ├── impactTin_medium_002.ogg
│           │       │   ├── impactTin_medium_003.ogg
│           │       │   ├── impactTin_medium_004.ogg
│           │       │   ├── impactWood_heavy_000.ogg
│           │       │   ├── impactWood_heavy_001.ogg
│           │       │   ├── impactWood_heavy_002.ogg
│           │       │   ├── impactWood_heavy_003.ogg
│           │       │   ├── impactWood_heavy_004.ogg
│           │       │   ├── impactWood_light_000.ogg
│           │       │   ├── impactWood_light_001.ogg
│           │       │   ├── impactWood_light_002.ogg
│           │       │   ├── impactWood_light_003.ogg
│           │       │   ├── impactWood_light_004.ogg
│           │       │   ├── impactWood_medium_000.ogg
│           │       │   ├── impactWood_medium_001.ogg
│           │       │   ├── impactWood_medium_002.ogg
│           │       │   ├── impactWood_medium_003.ogg
│           │       │   └── impactWood_medium_004.ogg
│           │       ├── interface
│           │       │   ├── bong_001.ogg
│           │       │   ├── click_001.ogg
│           │       │   ├── click_002.ogg
│           │       │   ├── click_003.ogg
│           │       │   ├── click_004.ogg
│           │       │   ├── click_005.ogg
│           │       │   ├── drop_001.ogg
│           │       │   ├── drop_002.ogg
│           │       │   ├── drop_003.ogg
│           │       │   ├── error_005.ogg
│           │       │   ├── error_006.ogg
│           │       │   ├── glitch_002.ogg
│           │       │   ├── glitch_004.ogg
│           │       │   ├── select_008.ogg
│           │       │   ├── switch_001.ogg
│           │       │   ├── switch_002.ogg
│           │       │   ├── switch_004.ogg
│           │       │   ├── switch_005.ogg
│           │       │   ├── switch_006.ogg
│           │       │   └── switch_007.ogg
│           │       ├── keyboard
│           │       │   ├── keypress-001.wav
│           │       │   ├── keypress-002.wav
│           │       │   ├── keypress-003.wav
│           │       │   ├── keypress-004.wav
│           │       │   ├── keypress-005.wav
│           │       │   ├── keypress-006.wav
│           │       │   ├── keypress-007.wav
│           │       │   ├── keypress-008.wav
│           │       │   ├── keypress-009.wav
│           │       │   ├── keypress-010.wav
│           │       │   ├── keypress-011.wav
│           │       │   ├── keypress-012.wav
│           │       │   ├── keypress-013.wav
│           │       │   ├── keypress-014.wav
│           │       │   ├── keypress-015.wav
│           │       │   ├── keypress-016.wav
│           │       │   ├── keypress-017.wav
│           │       │   ├── keypress-018.wav
│           │       │   ├── keypress-019.wav
│           │       │   ├── keypress-020.wav
│           │       │   ├── keypress-021.wav
│           │       │   ├── keypress-022.wav
│           │       │   ├── keypress-023.wav
│           │       │   ├── keypress-024.wav
│           │       │   ├── keypress-025.wav
│           │       │   ├── keypress-026.wav
│           │       │   ├── keypress-027.wav
│           │       │   ├── keypress-028.wav
│           │       │   ├── keypress-029.wav
│           │       │   ├── keypress-030.wav
│           │       │   ├── keypress-031.wav
│           │       │   └── keypress-032.wav
│           │       ├── ui
│           │       │   ├── click1.ogg
│           │       │   ├── click2.ogg
│           │       │   ├── click3.ogg
│           │       │   ├── click4.ogg
│           │       │   ├── click5.ogg
│           │       │   ├── mouseclick1.ogg
│           │       │   ├── rollover1.ogg
│           │       │   ├── rollover2.ogg
│           │       │   ├── rollover4.ogg
│           │       │   ├── rollover5.ogg
│           │       │   ├── switch1.ogg
│           │       │   ├── switch10.ogg
│           │       │   ├── switch11.ogg
│           │       │   ├── switch12.ogg
│           │       │   ├── switch13.ogg
│           │       │   ├── switch14.ogg
│           │       │   ├── switch15.ogg
│           │       │   ├── switch16.ogg
│           │       │   ├── switch17.ogg
│           │       │   ├── switch18.ogg
│           │       │   ├── switch19.ogg
│           │       │   ├── switch2.ogg
│           │       │   ├── switch20.ogg
│           │       │   ├── switch21.ogg
│           │       │   ├── switch22.ogg
│           │       │   ├── switch23.ogg
│           │       │   ├── switch24.ogg
│           │       │   ├── switch25.ogg
│           │       │   ├── switch26.ogg
│           │       │   ├── switch27.ogg
│           │       │   ├── switch28.ogg
│           │       │   ├── switch29.ogg
│           │       │   ├── switch3.ogg
│           │       │   ├── switch30.ogg
│           │       │   ├── switch31.ogg
│           │       │   ├── switch32.ogg
│           │       │   ├── switch33.ogg
│           │       │   ├── switch34.ogg
│           │       │   ├── switch35.ogg
│           │       │   ├── switch36.ogg
│           │       │   ├── switch37.ogg
│           │       │   ├── switch38.ogg
│           │       │   ├── switch4.ogg
│           │       │   ├── switch5.ogg
│           │       │   ├── switch6.ogg
│           │       │   ├── switch7.ogg
│           │       │   ├── switch8.ogg
│           │       │   └── switch9.ogg
│           │       ├── sfx-analysis.json
│           │       └── sfx-analysis.md
│           ├── references
│           │   ├── audio.md
│           │   ├── step-1-inspect.md
│           │   ├── step-2-plan.md
│           │   ├── step-3-compose.md
│           │   ├── step-4-deliver.md
│           │   └── tones.md
│           └── SKILL.md
├── .claude
│   └── skills
│       └── brag
│           ├── assets
│           │   ├── music
│           │   │   ├── cues
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json
│           │   │   │   └── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md
│           │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
│           │   │   └── README.md                     # Project overview and setup guide
│           │   └── sfx
│           │       ├── casino
│           │       │   ├── card-fan-1.ogg
│           │       │   ├── card-fan-2.ogg
│           │       │   ├── card-place-1.ogg
│           │       │   ├── card-place-2.ogg
│           │       │   ├── card-place-3.ogg
│           │       │   ├── card-place-4.ogg
│           │       │   ├── card-shove-1.ogg
│           │       │   ├── card-shove-2.ogg
│           │       │   ├── card-shove-3.ogg
│           │       │   ├── card-shove-4.ogg
│           │       │   ├── card-shuffle.ogg
│           │       │   ├── card-slide-1.ogg
│           │       │   ├── card-slide-2.ogg
│           │       │   ├── card-slide-3.ogg
│           │       │   ├── card-slide-4.ogg
│           │       │   ├── card-slide-5.ogg
│           │       │   ├── card-slide-6.ogg
│           │       │   ├── card-slide-7.ogg
│           │       │   ├── card-slide-8.ogg
│           │       │   ├── cards-pack-open-1.ogg
│           │       │   ├── cards-pack-open-2.ogg
│           │       │   ├── chip-lay-1.ogg
│           │       │   ├── chip-lay-2.ogg
│           │       │   ├── chip-lay-3.ogg
│           │       │   ├── chips-collide-1.ogg
│           │       │   ├── chips-collide-2.ogg
│           │       │   ├── chips-collide-3.ogg
│           │       │   ├── chips-collide-4.ogg
│           │       │   ├── chips-handle-1.ogg
│           │       │   ├── chips-handle-2.ogg
│           │       │   ├── chips-handle-3.ogg
│           │       │   ├── chips-handle-4.ogg
│           │       │   ├── chips-handle-6.ogg
│           │       │   ├── chips-stack-1.ogg
│           │       │   ├── chips-stack-2.ogg
│           │       │   ├── chips-stack-3.ogg
│           │       │   ├── chips-stack-4.ogg
│           │       │   ├── chips-stack-5.ogg
│           │       │   ├── chips-stack-6.ogg
│           │       │   ├── dice-grab-1.ogg
│           │       │   ├── dice-grab-2.ogg
│           │       │   ├── dice-shake-1.ogg
│           │       │   ├── dice-shake-2.ogg
│           │       │   ├── dice-shake-3.ogg
│           │       │   ├── dice-throw-1.ogg
│           │       │   ├── dice-throw-2.ogg
│           │       │   ├── dice-throw-3.ogg
│           │       │   ├── die-throw-1.ogg
│           │       │   ├── die-throw-2.ogg
│           │       │   ├── die-throw-3.ogg
│           │       │   └── die-throw-4.ogg
│           │       ├── impact
│           │       │   ├── footstep_carpet_000.ogg
│           │       │   ├── footstep_carpet_003.ogg
│           │       │   ├── footstep_carpet_004.ogg
│           │       │   ├── footstep_concrete_000.ogg
│           │       │   ├── footstep_concrete_001.ogg
│           │       │   ├── footstep_concrete_002.ogg
│           │       │   ├── footstep_concrete_003.ogg
│           │       │   ├── footstep_concrete_004.ogg
│           │       │   ├── footstep_grass_000.ogg
│           │       │   ├── footstep_grass_001.ogg
│           │       │   ├── footstep_grass_002.ogg
│           │       │   ├── footstep_grass_003.ogg
│           │       │   ├── footstep_grass_004.ogg
│           │       │   ├── footstep_snow_000.ogg
│           │       │   ├── footstep_snow_001.ogg
│           │       │   ├── footstep_snow_002.ogg
│           │       │   ├── footstep_snow_003.ogg
│           │       │   ├── footstep_snow_004.ogg
│           │       │   ├── footstep_wood_000.ogg
│           │       │   ├── footstep_wood_001.ogg
│           │       │   ├── footstep_wood_002.ogg
│           │       │   ├── footstep_wood_003.ogg
│           │       │   ├── footstep_wood_004.ogg
│           │       │   ├── impactBell_heavy_000.ogg
│           │       │   ├── impactBell_heavy_003.ogg
│           │       │   ├── impactBell_heavy_004.ogg
│           │       │   ├── impactGeneric_light_000.ogg
│           │       │   ├── impactGeneric_light_001.ogg
│           │       │   ├── impactGeneric_light_002.ogg
│           │       │   ├── impactGeneric_light_003.ogg
│           │       │   ├── impactGeneric_light_004.ogg
│           │       │   ├── impactGlass_heavy_002.ogg
│           │       │   ├── impactGlass_light_001.ogg
│           │       │   ├── impactGlass_light_002.ogg
│           │       │   ├── impactGlass_light_003.ogg
│           │       │   ├── impactGlass_medium_000.ogg
│           │       │   ├── impactGlass_medium_002.ogg
│           │       │   ├── impactGlass_medium_004.ogg
│           │       │   ├── impactMetal_heavy_000.ogg
│           │       │   ├── impactMetal_heavy_002.ogg
│           │       │   ├── impactMetal_heavy_004.ogg
│           │       │   ├── impactMetal_light_002.ogg
│           │       │   ├── impactMetal_light_003.ogg
│           │       │   ├── impactMetal_medium_000.ogg
│           │       │   ├── impactMetal_medium_001.ogg
│           │       │   ├── impactMetal_medium_002.ogg
│           │       │   ├── impactMetal_medium_003.ogg
│           │       │   ├── impactMetal_medium_004.ogg
│           │       │   ├── impactMining_001.ogg
│           │       │   ├── impactPlank_medium_000.ogg
│           │       │   ├── impactPlank_medium_001.ogg
│           │       │   ├── impactPlank_medium_002.ogg
│           │       │   ├── impactPlank_medium_003.ogg
│           │       │   ├── impactPlank_medium_004.ogg
│           │       │   ├── impactPlate_heavy_000.ogg
│           │       │   ├── impactPlate_heavy_001.ogg
│           │       │   ├── impactPlate_heavy_002.ogg
│           │       │   ├── impactPlate_heavy_003.ogg
│           │       │   ├── impactPlate_heavy_004.ogg
│           │       │   ├── impactPlate_light_000.ogg
│           │       │   ├── impactPlate_light_001.ogg
│           │       │   ├── impactPlate_light_002.ogg
│           │       │   ├── impactPlate_light_003.ogg
│           │       │   ├── impactPlate_light_004.ogg
│           │       │   ├── impactPlate_medium_000.ogg
│           │       │   ├── impactPlate_medium_001.ogg
│           │       │   ├── impactPlate_medium_002.ogg
│           │       │   ├── impactPlate_medium_003.ogg
│           │       │   ├── impactPlate_medium_004.ogg
│           │       │   ├── impactPunch_heavy_000.ogg
│           │       │   ├── impactPunch_heavy_001.ogg
│           │       │   ├── impactPunch_heavy_002.ogg
│           │       │   ├── impactPunch_heavy_003.ogg
│           │       │   ├── impactPunch_heavy_004.ogg
│           │       │   ├── impactPunch_medium_000.ogg
│           │       │   ├── impactPunch_medium_001.ogg
│           │       │   ├── impactPunch_medium_002.ogg
│           │       │   ├── impactPunch_medium_003.ogg
│           │       │   ├── impactPunch_medium_004.ogg
│           │       │   ├── impactSoft_heavy_000.ogg
│           │       │   ├── impactSoft_heavy_001.ogg
│           │       │   ├── impactSoft_heavy_002.ogg
│           │       │   ├── impactSoft_heavy_003.ogg
│           │       │   ├── impactSoft_heavy_004.ogg
│           │       │   ├── impactSoft_medium_000.ogg
│           │       │   ├── impactSoft_medium_001.ogg
│           │       │   ├── impactSoft_medium_002.ogg
│           │       │   ├── impactSoft_medium_003.ogg
│           │       │   ├── impactSoft_medium_004.ogg
│           │       │   ├── impactTin_medium_000.ogg
│           │       │   ├── impactTin_medium_001.ogg
│           │       │   ├── impactTin_medium_002.ogg
│           │       │   ├── impactTin_medium_003.ogg
│           │       │   ├── impactTin_medium_004.ogg
│           │       │   ├── impactWood_heavy_000.ogg
│           │       │   ├── impactWood_heavy_001.ogg
│           │       │   ├── impactWood_heavy_002.ogg
│           │       │   ├── impactWood_heavy_003.ogg
│           │       │   ├── impactWood_heavy_004.ogg
│           │       │   ├── impactWood_light_000.ogg
│           │       │   ├── impactWood_light_001.ogg
│           │       │   ├── impactWood_light_002.ogg
│           │       │   ├── impactWood_light_003.ogg
│           │       │   ├── impactWood_light_004.ogg
│           │       │   ├── impactWood_medium_000.ogg
│           │       │   ├── impactWood_medium_001.ogg
│           │       │   ├── impactWood_medium_002.ogg
│           │       │   ├── impactWood_medium_003.ogg
│           │       │   └── impactWood_medium_004.ogg
│           │       ├── interface
│           │       │   ├── bong_001.ogg
│           │       │   ├── click_001.ogg
│           │       │   ├── click_002.ogg
│           │       │   ├── click_003.ogg
│           │       │   ├── click_004.ogg
│           │       │   ├── click_005.ogg
│           │       │   ├── drop_001.ogg
│           │       │   ├── drop_002.ogg
│           │       │   ├── drop_003.ogg
│           │       │   ├── error_005.ogg
│           │       │   ├── error_006.ogg
│           │       │   ├── glitch_002.ogg
│           │       │   ├── glitch_004.ogg
│           │       │   ├── select_008.ogg
│           │       │   ├── switch_001.ogg
│           │       │   ├── switch_002.ogg
│           │       │   ├── switch_004.ogg
│           │       │   ├── switch_005.ogg
│           │       │   ├── switch_006.ogg
│           │       │   └── switch_007.ogg
│           │       ├── keyboard
│           │       │   ├── keypress-001.wav
│           │       │   ├── keypress-002.wav
│           │       │   ├── keypress-003.wav
│           │       │   ├── keypress-004.wav
│           │       │   ├── keypress-005.wav
│           │       │   ├── keypress-006.wav
│           │       │   ├── keypress-007.wav
│           │       │   ├── keypress-008.wav
│           │       │   ├── keypress-009.wav
│           │       │   ├── keypress-010.wav
│           │       │   ├── keypress-011.wav
│           │       │   ├── keypress-012.wav
│           │       │   ├── keypress-013.wav
│           │       │   ├── keypress-014.wav
│           │       │   ├── keypress-015.wav
│           │       │   ├── keypress-016.wav
│           │       │   ├── keypress-017.wav
│           │       │   ├── keypress-018.wav
│           │       │   ├── keypress-019.wav
│           │       │   ├── keypress-020.wav
│           │       │   ├── keypress-021.wav
│           │       │   ├── keypress-022.wav
│           │       │   ├── keypress-023.wav
│           │       │   ├── keypress-024.wav
│           │       │   ├── keypress-025.wav
│           │       │   ├── keypress-026.wav
│           │       │   ├── keypress-027.wav
│           │       │   ├── keypress-028.wav
│           │       │   ├── keypress-029.wav
│           │       │   ├── keypress-030.wav
│           │       │   ├── keypress-031.wav
│           │       │   └── keypress-032.wav
│           │       ├── ui
│           │       │   ├── click1.ogg
│           │       │   ├── click2.ogg
│           │       │   ├── click3.ogg
│           │       │   ├── click4.ogg
│           │       │   ├── click5.ogg
│           │       │   ├── mouseclick1.ogg
│           │       │   ├── rollover1.ogg
│           │       │   ├── rollover2.ogg
│           │       │   ├── rollover4.ogg
│           │       │   ├── rollover5.ogg
│           │       │   ├── switch1.ogg
│           │       │   ├── switch10.ogg
│           │       │   ├── switch11.ogg
│           │       │   ├── switch12.ogg
│           │       │   ├── switch13.ogg
│           │       │   ├── switch14.ogg
│           │       │   ├── switch15.ogg
│           │       │   ├── switch16.ogg
│           │       │   ├── switch17.ogg
│           │       │   ├── switch18.ogg
│           │       │   ├── switch19.ogg
│           │       │   ├── switch2.ogg
│           │       │   ├── switch20.ogg
│           │       │   ├── switch21.ogg
│           │       │   ├── switch22.ogg
│           │       │   ├── switch23.ogg
│           │       │   ├── switch24.ogg
│           │       │   ├── switch25.ogg
│           │       │   ├── switch26.ogg
│           │       │   ├── switch27.ogg
│           │       │   ├── switch28.ogg
│           │       │   ├── switch29.ogg
│           │       │   ├── switch3.ogg
│           │       │   ├── switch30.ogg
│           │       │   ├── switch31.ogg
│           │       │   ├── switch32.ogg
│           │       │   ├── switch33.ogg
│           │       │   ├── switch34.ogg
│           │       │   ├── switch35.ogg
│           │       │   ├── switch36.ogg
│           │       │   ├── switch37.ogg
│           │       │   ├── switch38.ogg
│           │       │   ├── switch4.ogg
│           │       │   ├── switch5.ogg
│           │       │   ├── switch6.ogg
│           │       │   ├── switch7.ogg
│           │       │   ├── switch8.ogg
│           │       │   └── switch9.ogg
│           │       ├── sfx-analysis.json
│           │       └── sfx-analysis.md
│           ├── references
│           │   ├── audio.md
│           │   ├── step-1-inspect.md
│           │   ├── step-2-plan.md
│           │   ├── step-3-compose.md
│           │   ├── step-4-deliver.md
│           │   └── tones.md
│           └── SKILL.md
├── .grok
│   └── skills
│       └── brag
│           ├── assets
│           │   ├── music
│           │   │   ├── cues
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json
│           │   │   │   └── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md
│           │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
│           │   │   └── README.md                     # Project overview and setup guide
│           │   └── sfx
│           │       ├── casino
│           │       │   ├── card-fan-1.ogg
│           │       │   ├── card-fan-2.ogg
│           │       │   ├── card-place-1.ogg
│           │       │   ├── card-place-2.ogg
│           │       │   ├── card-place-3.ogg
│           │       │   ├── card-place-4.ogg
│           │       │   ├── card-shove-1.ogg
│           │       │   ├── card-shove-2.ogg
│           │       │   ├── card-shove-3.ogg
│           │       │   ├── card-shove-4.ogg
│           │       │   ├── card-shuffle.ogg
│           │       │   ├── card-slide-1.ogg
│           │       │   ├── card-slide-2.ogg
│           │       │   ├── card-slide-3.ogg
│           │       │   ├── card-slide-4.ogg
│           │       │   ├── card-slide-5.ogg
│           │       │   ├── card-slide-6.ogg
│           │       │   ├── card-slide-7.ogg
│           │       │   ├── card-slide-8.ogg
│           │       │   ├── cards-pack-open-1.ogg
│           │       │   ├── cards-pack-open-2.ogg
│           │       │   ├── chip-lay-1.ogg
│           │       │   ├── chip-lay-2.ogg
│           │       │   ├── chip-lay-3.ogg
│           │       │   ├── chips-collide-1.ogg
│           │       │   ├── chips-collide-2.ogg
│           │       │   ├── chips-collide-3.ogg
│           │       │   ├── chips-collide-4.ogg
│           │       │   ├── chips-handle-1.ogg
│           │       │   ├── chips-handle-2.ogg
│           │       │   ├── chips-handle-3.ogg
│           │       │   ├── chips-handle-4.ogg
│           │       │   ├── chips-handle-6.ogg
│           │       │   ├── chips-stack-1.ogg
│           │       │   ├── chips-stack-2.ogg
│           │       │   ├── chips-stack-3.ogg
│           │       │   ├── chips-stack-4.ogg
│           │       │   ├── chips-stack-5.ogg
│           │       │   ├── chips-stack-6.ogg
│           │       │   ├── dice-grab-1.ogg
│           │       │   ├── dice-grab-2.ogg
│           │       │   ├── dice-shake-1.ogg
│           │       │   ├── dice-shake-2.ogg
│           │       │   ├── dice-shake-3.ogg
│           │       │   ├── dice-throw-1.ogg
│           │       │   ├── dice-throw-2.ogg
│           │       │   ├── dice-throw-3.ogg
│           │       │   ├── die-throw-1.ogg
│           │       │   ├── die-throw-2.ogg
│           │       │   ├── die-throw-3.ogg
│           │       │   └── die-throw-4.ogg
│           │       ├── impact
│           │       │   ├── footstep_carpet_000.ogg
│           │       │   ├── footstep_carpet_003.ogg
│           │       │   ├── footstep_carpet_004.ogg
│           │       │   ├── footstep_concrete_000.ogg
│           │       │   ├── footstep_concrete_001.ogg
│           │       │   ├── footstep_concrete_002.ogg
│           │       │   ├── footstep_concrete_003.ogg
│           │       │   ├── footstep_concrete_004.ogg
│           │       │   ├── footstep_grass_000.ogg
│           │       │   ├── footstep_grass_001.ogg
│           │       │   ├── footstep_grass_002.ogg
│           │       │   ├── footstep_grass_003.ogg
│           │       │   ├── footstep_grass_004.ogg
│           │       │   ├── footstep_snow_000.ogg
│           │       │   ├── footstep_snow_001.ogg
│           │       │   ├── footstep_snow_002.ogg
│           │       │   ├── footstep_snow_003.ogg
│           │       │   ├── footstep_snow_004.ogg
│           │       │   ├── footstep_wood_000.ogg
│           │       │   ├── footstep_wood_001.ogg
│           │       │   ├── footstep_wood_002.ogg
│           │       │   ├── footstep_wood_003.ogg
│           │       │   ├── footstep_wood_004.ogg
│           │       │   ├── impactBell_heavy_000.ogg
│           │       │   ├── impactBell_heavy_003.ogg
│           │       │   ├── impactBell_heavy_004.ogg
│           │       │   ├── impactGeneric_light_000.ogg
│           │       │   ├── impactGeneric_light_001.ogg
│           │       │   ├── impactGeneric_light_002.ogg
│           │       │   ├── impactGeneric_light_003.ogg
│           │       │   ├── impactGeneric_light_004.ogg
│           │       │   ├── impactGlass_heavy_002.ogg
│           │       │   ├── impactGlass_light_001.ogg
│           │       │   ├── impactGlass_light_002.ogg
│           │       │   ├── impactGlass_light_003.ogg
│           │       │   ├── impactGlass_medium_000.ogg
│           │       │   ├── impactGlass_medium_002.ogg
│           │       │   ├── impactGlass_medium_004.ogg
│           │       │   ├── impactMetal_heavy_000.ogg
│           │       │   ├── impactMetal_heavy_002.ogg
│           │       │   ├── impactMetal_heavy_004.ogg
│           │       │   ├── impactMetal_light_002.ogg
│           │       │   ├── impactMetal_light_003.ogg
│           │       │   ├── impactMetal_medium_000.ogg
│           │       │   ├── impactMetal_medium_001.ogg
│           │       │   ├── impactMetal_medium_002.ogg
│           │       │   ├── impactMetal_medium_003.ogg
│           │       │   ├── impactMetal_medium_004.ogg
│           │       │   ├── impactMining_001.ogg
│           │       │   ├── impactPlank_medium_000.ogg
│           │       │   ├── impactPlank_medium_001.ogg
│           │       │   ├── impactPlank_medium_002.ogg
│           │       │   ├── impactPlank_medium_003.ogg
│           │       │   ├── impactPlank_medium_004.ogg
│           │       │   ├── impactPlate_heavy_000.ogg
│           │       │   ├── impactPlate_heavy_001.ogg
│           │       │   ├── impactPlate_heavy_002.ogg
│           │       │   ├── impactPlate_heavy_003.ogg
│           │       │   ├── impactPlate_heavy_004.ogg
│           │       │   ├── impactPlate_light_000.ogg
│           │       │   ├── impactPlate_light_001.ogg
│           │       │   ├── impactPlate_light_002.ogg
│           │       │   ├── impactPlate_light_003.ogg
│           │       │   ├── impactPlate_light_004.ogg
│           │       │   ├── impactPlate_medium_000.ogg
│           │       │   ├── impactPlate_medium_001.ogg
│           │       │   ├── impactPlate_medium_002.ogg
│           │       │   ├── impactPlate_medium_003.ogg
│           │       │   ├── impactPlate_medium_004.ogg
│           │       │   ├── impactPunch_heavy_000.ogg
│           │       │   ├── impactPunch_heavy_001.ogg
│           │       │   ├── impactPunch_heavy_002.ogg
│           │       │   ├── impactPunch_heavy_003.ogg
│           │       │   ├── impactPunch_heavy_004.ogg
│           │       │   ├── impactPunch_medium_000.ogg
│           │       │   ├── impactPunch_medium_001.ogg
│           │       │   ├── impactPunch_medium_002.ogg
│           │       │   ├── impactPunch_medium_003.ogg
│           │       │   ├── impactPunch_medium_004.ogg
│           │       │   ├── impactSoft_heavy_000.ogg
│           │       │   ├── impactSoft_heavy_001.ogg
│           │       │   ├── impactSoft_heavy_002.ogg
│           │       │   ├── impactSoft_heavy_003.ogg
│           │       │   ├── impactSoft_heavy_004.ogg
│           │       │   ├── impactSoft_medium_000.ogg
│           │       │   ├── impactSoft_medium_001.ogg
│           │       │   ├── impactSoft_medium_002.ogg
│           │       │   ├── impactSoft_medium_003.ogg
│           │       │   ├── impactSoft_medium_004.ogg
│           │       │   ├── impactTin_medium_000.ogg
│           │       │   ├── impactTin_medium_001.ogg
│           │       │   ├── impactTin_medium_002.ogg
│           │       │   ├── impactTin_medium_003.ogg
│           │       │   ├── impactTin_medium_004.ogg
│           │       │   ├── impactWood_heavy_000.ogg
│           │       │   ├── impactWood_heavy_001.ogg
│           │       │   ├── impactWood_heavy_002.ogg
│           │       │   ├── impactWood_heavy_003.ogg
│           │       │   ├── impactWood_heavy_004.ogg
│           │       │   ├── impactWood_light_000.ogg
│           │       │   ├── impactWood_light_001.ogg
│           │       │   ├── impactWood_light_002.ogg
│           │       │   ├── impactWood_light_003.ogg
│           │       │   ├── impactWood_light_004.ogg
│           │       │   ├── impactWood_medium_000.ogg
│           │       │   ├── impactWood_medium_001.ogg
│           │       │   ├── impactWood_medium_002.ogg
│           │       │   ├── impactWood_medium_003.ogg
│           │       │   └── impactWood_medium_004.ogg
│           │       ├── interface
│           │       │   ├── bong_001.ogg
│           │       │   ├── click_001.ogg
│           │       │   ├── click_002.ogg
│           │       │   ├── click_003.ogg
│           │       │   ├── click_004.ogg
│           │       │   ├── click_005.ogg
│           │       │   ├── drop_001.ogg
│           │       │   ├── drop_002.ogg
│           │       │   ├── drop_003.ogg
│           │       │   ├── error_005.ogg
│           │       │   ├── error_006.ogg
│           │       │   ├── glitch_002.ogg
│           │       │   ├── glitch_004.ogg
│           │       │   ├── select_008.ogg
│           │       │   ├── switch_001.ogg
│           │       │   ├── switch_002.ogg
│           │       │   ├── switch_004.ogg
│           │       │   ├── switch_005.ogg
│           │       │   ├── switch_006.ogg
│           │       │   └── switch_007.ogg
│           │       ├── keyboard
│           │       │   ├── keypress-001.wav
│           │       │   ├── keypress-002.wav
│           │       │   ├── keypress-003.wav
│           │       │   ├── keypress-004.wav
│           │       │   ├── keypress-005.wav
│           │       │   ├── keypress-006.wav
│           │       │   ├── keypress-007.wav
│           │       │   ├── keypress-008.wav
│           │       │   ├── keypress-009.wav
│           │       │   ├── keypress-010.wav
│           │       │   ├── keypress-011.wav
│           │       │   ├── keypress-012.wav
│           │       │   ├── keypress-013.wav
│           │       │   ├── keypress-014.wav
│           │       │   ├── keypress-015.wav
│           │       │   ├── keypress-016.wav
│           │       │   ├── keypress-017.wav
│           │       │   ├── keypress-018.wav
│           │       │   ├── keypress-019.wav
│           │       │   ├── keypress-020.wav
│           │       │   ├── keypress-021.wav
│           │       │   ├── keypress-022.wav
│           │       │   ├── keypress-023.wav
│           │       │   ├── keypress-024.wav
│           │       │   ├── keypress-025.wav
│           │       │   ├── keypress-026.wav
│           │       │   ├── keypress-027.wav
│           │       │   ├── keypress-028.wav
│           │       │   ├── keypress-029.wav
│           │       │   ├── keypress-030.wav
│           │       │   ├── keypress-031.wav
│           │       │   └── keypress-032.wav
│           │       ├── ui
│           │       │   ├── click1.ogg
│           │       │   ├── click2.ogg
│           │       │   ├── click3.ogg
│           │       │   ├── click4.ogg
│           │       │   ├── click5.ogg
│           │       │   ├── mouseclick1.ogg
│           │       │   ├── rollover1.ogg
│           │       │   ├── rollover2.ogg
│           │       │   ├── rollover4.ogg
│           │       │   ├── rollover5.ogg
│           │       │   ├── switch1.ogg
│           │       │   ├── switch10.ogg
│           │       │   ├── switch11.ogg
│           │       │   ├── switch12.ogg
│           │       │   ├── switch13.ogg
│           │       │   ├── switch14.ogg
│           │       │   ├── switch15.ogg
│           │       │   ├── switch16.ogg
│           │       │   ├── switch17.ogg
│           │       │   ├── switch18.ogg
│           │       │   ├── switch19.ogg
│           │       │   ├── switch2.ogg
│           │       │   ├── switch20.ogg
│           │       │   ├── switch21.ogg
│           │       │   ├── switch22.ogg
│           │       │   ├── switch23.ogg
│           │       │   ├── switch24.ogg
│           │       │   ├── switch25.ogg
│           │       │   ├── switch26.ogg
│           │       │   ├── switch27.ogg
│           │       │   ├── switch28.ogg
│           │       │   ├── switch29.ogg
│           │       │   ├── switch3.ogg
│           │       │   ├── switch30.ogg
│           │       │   ├── switch31.ogg
│           │       │   ├── switch32.ogg
│           │       │   ├── switch33.ogg
│           │       │   ├── switch34.ogg
│           │       │   ├── switch35.ogg
│           │       │   ├── switch36.ogg
│           │       │   ├── switch37.ogg
│           │       │   ├── switch38.ogg
│           │       │   ├── switch4.ogg
│           │       │   ├── switch5.ogg
│           │       │   ├── switch6.ogg
│           │       │   ├── switch7.ogg
│           │       │   ├── switch8.ogg
│           │       │   └── switch9.ogg
│           │       ├── sfx-analysis.json
│           │       └── sfx-analysis.md
│           ├── references
│           │   ├── audio.md
│           │   ├── step-1-inspect.md
│           │   ├── step-2-plan.md
│           │   ├── step-3-compose.md
│           │   ├── step-4-deliver.md
│           │   └── tones.md
│           └── SKILL.md
├── .hermes
│   └── skills
│       └── brag
│           ├── assets
│           │   ├── music
│           │   │   ├── cues
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json
│           │   │   │   └── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md
│           │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
│           │   │   └── README.md                     # Project overview and setup guide
│           │   └── sfx
│           │       ├── casino
│           │       │   ├── card-fan-1.ogg
│           │       │   ├── card-fan-2.ogg
│           │       │   ├── card-place-1.ogg
│           │       │   ├── card-place-2.ogg
│           │       │   ├── card-place-3.ogg
│           │       │   ├── card-place-4.ogg
│           │       │   ├── card-shove-1.ogg
│           │       │   ├── card-shove-2.ogg
│           │       │   ├── card-shove-3.ogg
│           │       │   ├── card-shove-4.ogg
│           │       │   ├── card-shuffle.ogg
│           │       │   ├── card-slide-1.ogg
│           │       │   ├── card-slide-2.ogg
│           │       │   ├── card-slide-3.ogg
│           │       │   ├── card-slide-4.ogg
│           │       │   ├── card-slide-5.ogg
│           │       │   ├── card-slide-6.ogg
│           │       │   ├── card-slide-7.ogg
│           │       │   ├── card-slide-8.ogg
│           │       │   ├── cards-pack-open-1.ogg
│           │       │   ├── cards-pack-open-2.ogg
│           │       │   ├── chip-lay-1.ogg
│           │       │   ├── chip-lay-2.ogg
│           │       │   ├── chip-lay-3.ogg
│           │       │   ├── chips-collide-1.ogg
│           │       │   ├── chips-collide-2.ogg
│           │       │   ├── chips-collide-3.ogg
│           │       │   ├── chips-collide-4.ogg
│           │       │   ├── chips-handle-1.ogg
│           │       │   ├── chips-handle-2.ogg
│           │       │   ├── chips-handle-3.ogg
│           │       │   ├── chips-handle-4.ogg
│           │       │   ├── chips-handle-6.ogg
│           │       │   ├── chips-stack-1.ogg
│           │       │   ├── chips-stack-2.ogg
│           │       │   ├── chips-stack-3.ogg
│           │       │   ├── chips-stack-4.ogg
│           │       │   ├── chips-stack-5.ogg
│           │       │   ├── chips-stack-6.ogg
│           │       │   ├── dice-grab-1.ogg
│           │       │   ├── dice-grab-2.ogg
│           │       │   ├── dice-shake-1.ogg
│           │       │   ├── dice-shake-2.ogg
│           │       │   ├── dice-shake-3.ogg
│           │       │   ├── dice-throw-1.ogg
│           │       │   ├── dice-throw-2.ogg
│           │       │   ├── dice-throw-3.ogg
│           │       │   ├── die-throw-1.ogg
│           │       │   ├── die-throw-2.ogg
│           │       │   ├── die-throw-3.ogg
│           │       │   └── die-throw-4.ogg
│           │       ├── impact
│           │       │   ├── footstep_carpet_000.ogg
│           │       │   ├── footstep_carpet_003.ogg
│           │       │   ├── footstep_carpet_004.ogg
│           │       │   ├── footstep_concrete_000.ogg
│           │       │   ├── footstep_concrete_001.ogg
│           │       │   ├── footstep_concrete_002.ogg
│           │       │   ├── footstep_concrete_003.ogg
│           │       │   ├── footstep_concrete_004.ogg
│           │       │   ├── footstep_grass_000.ogg
│           │       │   ├── footstep_grass_001.ogg
│           │       │   ├── footstep_grass_002.ogg
│           │       │   ├── footstep_grass_003.ogg
│           │       │   ├── footstep_grass_004.ogg
│           │       │   ├── footstep_snow_000.ogg
│           │       │   ├── footstep_snow_001.ogg
│           │       │   ├── footstep_snow_002.ogg
│           │       │   ├── footstep_snow_003.ogg
│           │       │   ├── footstep_snow_004.ogg
│           │       │   ├── footstep_wood_000.ogg
│           │       │   ├── footstep_wood_001.ogg
│           │       │   ├── footstep_wood_002.ogg
│           │       │   ├── footstep_wood_003.ogg
│           │       │   ├── footstep_wood_004.ogg
│           │       │   ├── impactBell_heavy_000.ogg
│           │       │   ├── impactBell_heavy_003.ogg
│           │       │   ├── impactBell_heavy_004.ogg
│           │       │   ├── impactGeneric_light_000.ogg
│           │       │   ├── impactGeneric_light_001.ogg
│           │       │   ├── impactGeneric_light_002.ogg
│           │       │   ├── impactGeneric_light_003.ogg
│           │       │   ├── impactGeneric_light_004.ogg
│           │       │   ├── impactGlass_heavy_002.ogg
│           │       │   ├── impactGlass_light_001.ogg
│           │       │   ├── impactGlass_light_002.ogg
│           │       │   ├── impactGlass_light_003.ogg
│           │       │   ├── impactGlass_medium_000.ogg
│           │       │   ├── impactGlass_medium_002.ogg
│           │       │   ├── impactGlass_medium_004.ogg
│           │       │   ├── impactMetal_heavy_000.ogg
│           │       │   ├── impactMetal_heavy_002.ogg
│           │       │   ├── impactMetal_heavy_004.ogg
│           │       │   ├── impactMetal_light_002.ogg
│           │       │   ├── impactMetal_light_003.ogg
│           │       │   ├── impactMetal_medium_000.ogg
│           │       │   ├── impactMetal_medium_001.ogg
│           │       │   ├── impactMetal_medium_002.ogg
│           │       │   ├── impactMetal_medium_003.ogg
│           │       │   ├── impactMetal_medium_004.ogg
│           │       │   ├── impactMining_001.ogg
│           │       │   ├── impactPlank_medium_000.ogg
│           │       │   ├── impactPlank_medium_001.ogg
│           │       │   ├── impactPlank_medium_002.ogg
│           │       │   ├── impactPlank_medium_003.ogg
│           │       │   ├── impactPlank_medium_004.ogg
│           │       │   ├── impactPlate_heavy_000.ogg
│           │       │   ├── impactPlate_heavy_001.ogg
│           │       │   ├── impactPlate_heavy_002.ogg
│           │       │   ├── impactPlate_heavy_003.ogg
│           │       │   ├── impactPlate_heavy_004.ogg
│           │       │   ├── impactPlate_light_000.ogg
│           │       │   ├── impactPlate_light_001.ogg
│           │       │   ├── impactPlate_light_002.ogg
│           │       │   ├── impactPlate_light_003.ogg
│           │       │   ├── impactPlate_light_004.ogg
│           │       │   ├── impactPlate_medium_000.ogg
│           │       │   ├── impactPlate_medium_001.ogg
│           │       │   ├── impactPlate_medium_002.ogg
│           │       │   ├── impactPlate_medium_003.ogg
│           │       │   ├── impactPlate_medium_004.ogg
│           │       │   ├── impactPunch_heavy_000.ogg
│           │       │   ├── impactPunch_heavy_001.ogg
│           │       │   ├── impactPunch_heavy_002.ogg
│           │       │   ├── impactPunch_heavy_003.ogg
│           │       │   ├── impactPunch_heavy_004.ogg
│           │       │   ├── impactPunch_medium_000.ogg
│           │       │   ├── impactPunch_medium_001.ogg
│           │       │   ├── impactPunch_medium_002.ogg
│           │       │   ├── impactPunch_medium_003.ogg
│           │       │   ├── impactPunch_medium_004.ogg
│           │       │   ├── impactSoft_heavy_000.ogg
│           │       │   ├── impactSoft_heavy_001.ogg
│           │       │   ├── impactSoft_heavy_002.ogg
│           │       │   ├── impactSoft_heavy_003.ogg
│           │       │   ├── impactSoft_heavy_004.ogg
│           │       │   ├── impactSoft_medium_000.ogg
│           │       │   ├── impactSoft_medium_001.ogg
│           │       │   ├── impactSoft_medium_002.ogg
│           │       │   ├── impactSoft_medium_003.ogg
│           │       │   ├── impactSoft_medium_004.ogg
│           │       │   ├── impactTin_medium_000.ogg
│           │       │   ├── impactTin_medium_001.ogg
│           │       │   ├── impactTin_medium_002.ogg
│           │       │   ├── impactTin_medium_003.ogg
│           │       │   ├── impactTin_medium_004.ogg
│           │       │   ├── impactWood_heavy_000.ogg
│           │       │   ├── impactWood_heavy_001.ogg
│           │       │   ├── impactWood_heavy_002.ogg
│           │       │   ├── impactWood_heavy_003.ogg
│           │       │   ├── impactWood_heavy_004.ogg
│           │       │   ├── impactWood_light_000.ogg
│           │       │   ├── impactWood_light_001.ogg
│           │       │   ├── impactWood_light_002.ogg
│           │       │   ├── impactWood_light_003.ogg
│           │       │   ├── impactWood_light_004.ogg
│           │       │   ├── impactWood_medium_000.ogg
│           │       │   ├── impactWood_medium_001.ogg
│           │       │   ├── impactWood_medium_002.ogg
│           │       │   ├── impactWood_medium_003.ogg
│           │       │   └── impactWood_medium_004.ogg
│           │       ├── interface
│           │       │   ├── bong_001.ogg
│           │       │   ├── click_001.ogg
│           │       │   ├── click_002.ogg
│           │       │   ├── click_003.ogg
│           │       │   ├── click_004.ogg
│           │       │   ├── click_005.ogg
│           │       │   ├── drop_001.ogg
│           │       │   ├── drop_002.ogg
│           │       │   ├── drop_003.ogg
│           │       │   ├── error_005.ogg
│           │       │   ├── error_006.ogg
│           │       │   ├── glitch_002.ogg
│           │       │   ├── glitch_004.ogg
│           │       │   ├── select_008.ogg
│           │       │   ├── switch_001.ogg
│           │       │   ├── switch_002.ogg
│           │       │   ├── switch_004.ogg
│           │       │   ├── switch_005.ogg
│           │       │   ├── switch_006.ogg
│           │       │   └── switch_007.ogg
│           │       ├── keyboard
│           │       │   ├── keypress-001.wav
│           │       │   ├── keypress-002.wav
│           │       │   ├── keypress-003.wav
│           │       │   ├── keypress-004.wav
│           │       │   ├── keypress-005.wav
│           │       │   ├── keypress-006.wav
│           │       │   ├── keypress-007.wav
│           │       │   ├── keypress-008.wav
│           │       │   ├── keypress-009.wav
│           │       │   ├── keypress-010.wav
│           │       │   ├── keypress-011.wav
│           │       │   ├── keypress-012.wav
│           │       │   ├── keypress-013.wav
│           │       │   ├── keypress-014.wav
│           │       │   ├── keypress-015.wav
│           │       │   ├── keypress-016.wav
│           │       │   ├── keypress-017.wav
│           │       │   ├── keypress-018.wav
│           │       │   ├── keypress-019.wav
│           │       │   ├── keypress-020.wav
│           │       │   ├── keypress-021.wav
│           │       │   ├── keypress-022.wav
│           │       │   ├── keypress-023.wav
│           │       │   ├── keypress-024.wav
│           │       │   ├── keypress-025.wav
│           │       │   ├── keypress-026.wav
│           │       │   ├── keypress-027.wav
│           │       │   ├── keypress-028.wav
│           │       │   ├── keypress-029.wav
│           │       │   ├── keypress-030.wav
│           │       │   ├── keypress-031.wav
│           │       │   └── keypress-032.wav
│           │       ├── ui
│           │       │   ├── click1.ogg
│           │       │   ├── click2.ogg
│           │       │   ├── click3.ogg
│           │       │   ├── click4.ogg
│           │       │   ├── click5.ogg
│           │       │   ├── mouseclick1.ogg
│           │       │   ├── rollover1.ogg
│           │       │   ├── rollover2.ogg
│           │       │   ├── rollover4.ogg
│           │       │   ├── rollover5.ogg
│           │       │   ├── switch1.ogg
│           │       │   ├── switch10.ogg
│           │       │   ├── switch11.ogg
│           │       │   ├── switch12.ogg
│           │       │   ├── switch13.ogg
│           │       │   ├── switch14.ogg
│           │       │   ├── switch15.ogg
│           │       │   ├── switch16.ogg
│           │       │   ├── switch17.ogg
│           │       │   ├── switch18.ogg
│           │       │   ├── switch19.ogg
│           │       │   ├── switch2.ogg
│           │       │   ├── switch20.ogg
│           │       │   ├── switch21.ogg
│           │       │   ├── switch22.ogg
│           │       │   ├── switch23.ogg
│           │       │   ├── switch24.ogg
│           │       │   ├── switch25.ogg
│           │       │   ├── switch26.ogg
│           │       │   ├── switch27.ogg
│           │       │   ├── switch28.ogg
│           │       │   ├── switch29.ogg
│           │       │   ├── switch3.ogg
│           │       │   ├── switch30.ogg
│           │       │   ├── switch31.ogg
│           │       │   ├── switch32.ogg
│           │       │   ├── switch33.ogg
│           │       │   ├── switch34.ogg
│           │       │   ├── switch35.ogg
│           │       │   ├── switch36.ogg
│           │       │   ├── switch37.ogg
│           │       │   ├── switch38.ogg
│           │       │   ├── switch4.ogg
│           │       │   ├── switch5.ogg
│           │       │   ├── switch6.ogg
│           │       │   ├── switch7.ogg
│           │       │   ├── switch8.ogg
│           │       │   └── switch9.ogg
│           │       ├── sfx-analysis.json
│           │       └── sfx-analysis.md
│           ├── references
│           │   ├── audio.md
│           │   ├── step-1-inspect.md
│           │   ├── step-2-plan.md
│           │   ├── step-3-compose.md
│           │   ├── step-4-deliver.md
│           │   └── tones.md
│           └── SKILL.md
├── .knowledge
│   ├── .knowledge_meta.json
│   ├── fetch-knowledge.ps1
│   ├── fetch-knowledge.sh
│   ├── update-knowledge.ps1
│   └── update-knowledge.sh
├── .windsurf
│   └── skills
│       └── brag
│           ├── assets
│           │   ├── music
│           │   │   ├── cues
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json
│           │   │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md
│           │   │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json
│           │   │   │   └── happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md
│           │   │   ├── happy-beats-business-moves-vol-1-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-10-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
│           │   │   ├── happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
│           │   │   └── README.md                     # Project overview and setup guide
│           │   └── sfx
│           │       ├── casino
│           │       │   ├── card-fan-1.ogg
│           │       │   ├── card-fan-2.ogg
│           │       │   ├── card-place-1.ogg
│           │       │   ├── card-place-2.ogg
│           │       │   ├── card-place-3.ogg
│           │       │   ├── card-place-4.ogg
│           │       │   ├── card-shove-1.ogg
│           │       │   ├── card-shove-2.ogg
│           │       │   ├── card-shove-3.ogg
│           │       │   ├── card-shove-4.ogg
│           │       │   ├── card-shuffle.ogg
│           │       │   ├── card-slide-1.ogg
│           │       │   ├── card-slide-2.ogg
│           │       │   ├── card-slide-3.ogg
│           │       │   ├── card-slide-4.ogg
│           │       │   ├── card-slide-5.ogg
│           │       │   ├── card-slide-6.ogg
│           │       │   ├── card-slide-7.ogg
│           │       │   ├── card-slide-8.ogg
│           │       │   ├── cards-pack-open-1.ogg
│           │       │   ├── cards-pack-open-2.ogg
│           │       │   ├── chip-lay-1.ogg
│           │       │   ├── chip-lay-2.ogg
│           │       │   ├── chip-lay-3.ogg
│           │       │   ├── chips-collide-1.ogg
│           │       │   ├── chips-collide-2.ogg
│           │       │   ├── chips-collide-3.ogg
│           │       │   ├── chips-collide-4.ogg
│           │       │   ├── chips-handle-1.ogg
│           │       │   ├── chips-handle-2.ogg
│           │       │   ├── chips-handle-3.ogg
│           │       │   ├── chips-handle-4.ogg
│           │       │   ├── chips-handle-6.ogg
│           │       │   ├── chips-stack-1.ogg
│           │       │   ├── chips-stack-2.ogg
│           │       │   ├── chips-stack-3.ogg
│           │       │   ├── chips-stack-4.ogg
│           │       │   ├── chips-stack-5.ogg
│           │       │   ├── chips-stack-6.ogg
│           │       │   ├── dice-grab-1.ogg
│           │       │   ├── dice-grab-2.ogg
│           │       │   ├── dice-shake-1.ogg
│           │       │   ├── dice-shake-2.ogg
│           │       │   ├── dice-shake-3.ogg
│           │       │   ├── dice-throw-1.ogg
│           │       │   ├── dice-throw-2.ogg
│           │       │   ├── dice-throw-3.ogg
│           │       │   ├── die-throw-1.ogg
│           │       │   ├── die-throw-2.ogg
│           │       │   ├── die-throw-3.ogg
│           │       │   └── die-throw-4.ogg
│           │       ├── impact
│           │       │   ├── footstep_carpet_000.ogg
│           │       │   ├── footstep_carpet_003.ogg
│           │       │   ├── footstep_carpet_004.ogg
│           │       │   ├── footstep_concrete_000.ogg
│           │       │   ├── footstep_concrete_001.ogg
│           │       │   ├── footstep_concrete_002.ogg
│           │       │   ├── footstep_concrete_003.ogg
│           │       │   ├── footstep_concrete_004.ogg
│           │       │   ├── footstep_grass_000.ogg
│           │       │   ├── footstep_grass_001.ogg
│           │       │   ├── footstep_grass_002.ogg
│           │       │   ├── footstep_grass_003.ogg
│           │       │   ├── footstep_grass_004.ogg
│           │       │   ├── footstep_snow_000.ogg
│           │       │   ├── footstep_snow_001.ogg
│           │       │   ├── footstep_snow_002.ogg
│           │       │   ├── footstep_snow_003.ogg
│           │       │   ├── footstep_snow_004.ogg
│           │       │   ├── footstep_wood_000.ogg
│           │       │   ├── footstep_wood_001.ogg
│           │       │   ├── footstep_wood_002.ogg
│           │       │   ├── footstep_wood_003.ogg
│           │       │   ├── footstep_wood_004.ogg
│           │       │   ├── impactBell_heavy_000.ogg
│           │       │   ├── impactBell_heavy_003.ogg
│           │       │   ├── impactBell_heavy_004.ogg
│           │       │   ├── impactGeneric_light_000.ogg
│           │       │   ├── impactGeneric_light_001.ogg
│           │       │   ├── impactGeneric_light_002.ogg
│           │       │   ├── impactGeneric_light_003.ogg
│           │       │   ├── impactGeneric_light_004.ogg
│           │       │   ├── impactGlass_heavy_002.ogg
│           │       │   ├── impactGlass_light_001.ogg
│           │       │   ├── impactGlass_light_002.ogg
│           │       │   ├── impactGlass_light_003.ogg
│           │       │   ├── impactGlass_medium_000.ogg
│           │       │   ├── impactGlass_medium_002.ogg
│           │       │   ├── impactGlass_medium_004.ogg
│           │       │   ├── impactMetal_heavy_000.ogg
│           │       │   ├── impactMetal_heavy_002.ogg
│           │       │   ├── impactMetal_heavy_004.ogg
│           │       │   ├── impactMetal_light_002.ogg
│           │       │   ├── impactMetal_light_003.ogg
│           │       │   ├── impactMetal_medium_000.ogg
│           │       │   ├── impactMetal_medium_001.ogg
│           │       │   ├── impactMetal_medium_002.ogg
│           │       │   ├── impactMetal_medium_003.ogg
│           │       │   ├── impactMetal_medium_004.ogg
│           │       │   ├── impactMining_001.ogg
│           │       │   ├── impactPlank_medium_000.ogg
│           │       │   ├── impactPlank_medium_001.ogg
│           │       │   ├── impactPlank_medium_002.ogg
│           │       │   ├── impactPlank_medium_003.ogg
│           │       │   ├── impactPlank_medium_004.ogg
│           │       │   ├── impactPlate_heavy_000.ogg
│           │       │   ├── impactPlate_heavy_001.ogg
│           │       │   ├── impactPlate_heavy_002.ogg
│           │       │   ├── impactPlate_heavy_003.ogg
│           │       │   ├── impactPlate_heavy_004.ogg
│           │       │   ├── impactPlate_light_000.ogg
│           │       │   ├── impactPlate_light_001.ogg
│           │       │   ├── impactPlate_light_002.ogg
│           │       │   ├── impactPlate_light_003.ogg
│           │       │   ├── impactPlate_light_004.ogg
│           │       │   ├── impactPlate_medium_000.ogg
│           │       │   ├── impactPlate_medium_001.ogg
│           │       │   ├── impactPlate_medium_002.ogg
│           │       │   ├── impactPlate_medium_003.ogg
│           │       │   ├── impactPlate_medium_004.ogg
│           │       │   ├── impactPunch_heavy_000.ogg
│           │       │   ├── impactPunch_heavy_001.ogg
│           │       │   ├── impactPunch_heavy_002.ogg
│           │       │   ├── impactPunch_heavy_003.ogg
│           │       │   ├── impactPunch_heavy_004.ogg
│           │       │   ├── impactPunch_medium_000.ogg
│           │       │   ├── impactPunch_medium_001.ogg
│           │       │   ├── impactPunch_medium_002.ogg
│           │       │   ├── impactPunch_medium_003.ogg
│           │       │   ├── impactPunch_medium_004.ogg
│           │       │   ├── impactSoft_heavy_000.ogg
│           │       │   ├── impactSoft_heavy_001.ogg
│           │       │   ├── impactSoft_heavy_002.ogg
│           │       │   ├── impactSoft_heavy_003.ogg
│           │       │   ├── impactSoft_heavy_004.ogg
│           │       │   ├── impactSoft_medium_000.ogg
│           │       │   ├── impactSoft_medium_001.ogg
│           │       │   ├── impactSoft_medium_002.ogg
│           │       │   ├── impactSoft_medium_003.ogg
│           │       │   ├── impactSoft_medium_004.ogg
│           │       │   ├── impactTin_medium_000.ogg
│           │       │   ├── impactTin_medium_001.ogg
│           │       │   ├── impactTin_medium_002.ogg
│           │       │   ├── impactTin_medium_003.ogg
│           │       │   ├── impactTin_medium_004.ogg
│           │       │   ├── impactWood_heavy_000.ogg
│           │       │   ├── impactWood_heavy_001.ogg
│           │       │   ├── impactWood_heavy_002.ogg
│           │       │   ├── impactWood_heavy_003.ogg
│           │       │   ├── impactWood_heavy_004.ogg
│           │       │   ├── impactWood_light_000.ogg
│           │       │   ├── impactWood_light_001.ogg
│           │       │   ├── impactWood_light_002.ogg
│           │       │   ├── impactWood_light_003.ogg
│           │       │   ├── impactWood_light_004.ogg
│           │       │   ├── impactWood_medium_000.ogg
│           │       │   ├── impactWood_medium_001.ogg
│           │       │   ├── impactWood_medium_002.ogg
│           │       │   ├── impactWood_medium_003.ogg
│           │       │   └── impactWood_medium_004.ogg
│           │       ├── interface
│           │       │   ├── bong_001.ogg
│           │       │   ├── click_001.ogg
│           │       │   ├── click_002.ogg
│           │       │   ├── click_003.ogg
│           │       │   ├── click_004.ogg
│           │       │   ├── click_005.ogg
│           │       │   ├── drop_001.ogg
│           │       │   ├── drop_002.ogg
│           │       │   ├── drop_003.ogg
│           │       │   ├── error_005.ogg
│           │       │   ├── error_006.ogg
│           │       │   ├── glitch_002.ogg
│           │       │   ├── glitch_004.ogg
│           │       │   ├── select_008.ogg
│           │       │   ├── switch_001.ogg
│           │       │   ├── switch_002.ogg
│           │       │   ├── switch_004.ogg
│           │       │   ├── switch_005.ogg
│           │       │   ├── switch_006.ogg
│           │       │   └── switch_007.ogg
│           │       ├── keyboard
│           │       │   ├── keypress-001.wav
│           │       │   ├── keypress-002.wav
│           │       │   ├── keypress-003.wav
│           │       │   ├── keypress-004.wav
│           │       │   ├── keypress-005.wav
│           │       │   ├── keypress-006.wav
│           │       │   ├── keypress-007.wav
│           │       │   ├── keypress-008.wav
│           │       │   ├── keypress-009.wav
│           │       │   ├── keypress-010.wav
│           │       │   ├── keypress-011.wav
│           │       │   ├── keypress-012.wav
│           │       │   ├── keypress-013.wav
│           │       │   ├── keypress-014.wav
│           │       │   ├── keypress-015.wav
│           │       │   ├── keypress-016.wav
│           │       │   ├── keypress-017.wav
│           │       │   ├── keypress-018.wav
│           │       │   ├── keypress-019.wav
│           │       │   ├── keypress-020.wav
│           │       │   ├── keypress-021.wav
│           │       │   ├── keypress-022.wav
│           │       │   ├── keypress-023.wav
│           │       │   ├── keypress-024.wav
│           │       │   ├── keypress-025.wav
│           │       │   ├── keypress-026.wav
│           │       │   ├── keypress-027.wav
│           │       │   ├── keypress-028.wav
│           │       │   ├── keypress-029.wav
│           │       │   ├── keypress-030.wav
│           │       │   ├── keypress-031.wav
│           │       │   └── keypress-032.wav
│           │       ├── ui
│           │       │   ├── click1.ogg
│           │       │   ├── click2.ogg
│           │       │   ├── click3.ogg
│           │       │   ├── click4.ogg
│           │       │   ├── click5.ogg
│           │       │   ├── mouseclick1.ogg
│           │       │   ├── rollover1.ogg
│           │       │   ├── rollover2.ogg
│           │       │   ├── rollover4.ogg
│           │       │   ├── rollover5.ogg
│           │       │   ├── switch1.ogg
│           │       │   ├── switch10.ogg
│           │       │   ├── switch11.ogg
│           │       │   ├── switch12.ogg
│           │       │   ├── switch13.ogg
│           │       │   ├── switch14.ogg
│           │       │   ├── switch15.ogg
│           │       │   ├── switch16.ogg
│           │       │   ├── switch17.ogg
│           │       │   ├── switch18.ogg
│           │       │   ├── switch19.ogg
│           │       │   ├── switch2.ogg
│           │       │   ├── switch20.ogg
│           │       │   ├── switch21.ogg
│           │       │   ├── switch22.ogg
│           │       │   ├── switch23.ogg
│           │       │   ├── switch24.ogg
│           │       │   ├── switch25.ogg
│           │       │   ├── switch26.ogg
│           │       │   ├── switch27.ogg
│           │       │   ├── switch28.ogg
│           │       │   ├── switch29.ogg
│           │       │   ├── switch3.ogg
│           │       │   ├── switch30.ogg
│           │       │   ├── switch31.ogg
│           │       │   ├── switch32.ogg
│           │       │   ├── switch33.ogg
│           │       │   ├── switch34.ogg
│           │       │   ├── switch35.ogg
│           │       │   ├── switch36.ogg
│           │       │   ├── switch37.ogg
│           │       │   ├── switch38.ogg
│           │       │   ├── switch4.ogg
│           │       │   ├── switch5.ogg
│           │       │   ├── switch6.ogg
│           │       │   ├── switch7.ogg
│           │       │   ├── switch8.ogg
│           │       │   └── switch9.ogg
│           │       ├── sfx-analysis.json
│           │       └── sfx-analysis.md
│           ├── references
│           │   ├── audio.md
│           │   ├── step-1-inspect.md
│           │   ├── step-2-plan.md
│           │   ├── step-3-compose.md
│           │   ├── step-4-deliver.md
│           │   └── tones.md
│           └── SKILL.md
├── brag-output-2026-09-19-042303
│   ├── composition
│   │   ├── assets
│   │   │   ├── music
│   │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
│   │   │   │   ├── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json
│   │   │   │   └── happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md
│   │   │   └── sfx
│   │   │       ├── impact
│   │   │       │   └── impactSoft_medium_001.ogg
│   │   │       └── interface
│   │   │           ├── click_001.ogg
│   │   │           └── drop_001.ogg
│   │   ├── beats
│   │   │   └── assets
│   │   │       └── music
│   │   │           └── happy-beats-business-moves-vol-11-by-ende-dot-app.mp3.json
│   │   ├── snapshots
│   │   │   ├── contact-sheet.jpg
│   │   │   ├── frame-00-at-0s.png
│   │   │   ├── frame-01-at-5.013s.png
│   │   │   ├── frame-02-at-10.025s.png
│   │   │   ├── frame-03-at-15.038s.png
│   │   │   └── frame-04-at-19.449s.png
│   │   └── index.html                                # HTML entry point
│   ├── .DS_Store
│   ├── brag-plan.md
│   ├── brag.mp4
│   └── composition-brief.md
├── d1                                                # Cloudflare D1 database (NEW — Phase 2)
│   ├── migrations
│   │   ├── 000_complete_setup.sql
│   │   ├── 002_analytics.sql
│   │   ├── 003_categorisation.sql
│   │   ├── 004_ai_judge.sql
│   │   ├── 004_curation.sql
│   │   ├── 005_curation_final.sql
│   │   ├── 006_judge_ai_presets.sql
│   │   ├── 007_add_judge4_judge5.sql
│   │   ├── 008_optimize_curation_indexes.sql
│   │   ├── 009_add_api_password_to_users.sql
│   │   ├── 010_enforce_superadmin_active_and_cleanup_judges.sql
│   │   ├── 011_force_removals.sql
│   │   ├── 011_reconcile_active_and_curation_sync.sql
│   │   ├── 012_add_curation_status_to_memes.sql
│   │   ├── 013_add_nsfw_flag.sql                     # D1 migration 013: is_nsfw & nsfw_flagged_by columns
│   │   ├── 014_add_resolved_curation_fields.sql
│   │   ├── 015_android_analytics_events.sql
│   │   ├── 016_android_analytics_schema_version.sql
│   │   ├── 017_android_analytics_query_indexes.sql
│   │   └── 018_android_analytics_deletion_audit.sql
│   │   └── 016_android_analytics_schema_version.sql
│   ├── .DS_Store
│   ├── schema.sql                                    # SQLite schema for meme metadata
│   └── seed.sql
├── docs                                              # Dedicated project documentation folder
│   ├── planning                                      # Project planning and roadmap (in docs/)
│   │   ├── AI-SPEC.md
│   │   ├── Multi-Judge Majority Consensus — curate Implementation Prompt.md
│   │   └── ROADMAP.md                                # Phase-by-phase development plan
│   ├── .DS_Store
│   ├── AGENT_RULES.md
│   ├── AGENTS.md
│   ├── AI_AGENT_SINGLE_SOURCE_OF_TRUTH.md
│   ├── AI_PREJUDGE_CURATE_ANALYSIS.md
│   ├── ANALYTICS_API_SPEC.md
│   ├── ANALYTICS_DASHBOARD_PRODUCTION_PLAN.md
│   ├── ANDROID_ANALYTICS_DATA_COLLECTION_STANDARD.md
│   ├── CAPACITY_ANALYSIS.md
│   ├── CHANGELOG.md                                  # Version history
│   ├── CLAUDE.md                                     # Development setup & commands guide
│   ├── CLOUDFLARE_D1_USAGE_AND_OPTIMIZATION_REPORT.md
│   ├── CLOUDFLARE_FREE_TIER_CAPACITY_AUDIT.md
│   ├── CLOUDFLARE_LIMITS_AND_SCALING_RESEARCH.md
│   ├── DATABASE.md                                   # Database and storage architecture docs
│   ├── FORCE_REMOVE_FEATURE.md
│   ├── GEMINI.md
│   ├── majority-consensus-curation-walkthrough.md
│   ├── MEME_CAPSULE_KNOWLEDGE.md
│   ├── PRIVACY_COOKIES_AND_DATA_FLOWS.md
│   ├── PROJECT_STRUCTURE.md                          # This file
│   ├── README_ANALYTICS.md
│   ├── README.md                                     # Project overview and setup guide
│   ├── report.md
│   ├── SECURITY_PRIVACY_COMPLIANCE_AND_SCALING_PLAN.md
│   ├── STATE.md                                      # Current project state and next actions (in docs/)
│   └── walkthrough.md
├── functions                                         # Cloudflare Pages Functions (serverless API)
│   ├── _shared                                       # Shared utilities for all API routes
│   │   ├── aiJudgeAuth.ts
│   │   ├── analyticsCache.ts
│   │   ├── analyticsFormulas.ts
│   │   ├── catAuth.ts
│   │   ├── catConsensus.ts
│   │   ├── crypto.ts
│   │   ├── curateDb.ts
│   │   ├── curationConsensus.ts
│   │   ├── d1r2.ts                                   # D1 + R2 helper (NEW — replaces supabase.ts)
│   │   ├── fallbackMemes.ts                          # Static fallback memes for offline/empty DB
│   │   ├── forceRemove.ts
│   │   └── pages.ts                                  # Cloudflare Pages type definitions
│   ├── api                                           # API route handlers
│   │   ├── admin                                     # Admin dashboard
│   │   │   ├── ai
│   │   │   │   └── override.ts
│   │   │   ├── analytics
│   │   │   │   ├── meme
│   │   │   │   │   └── [memeId].ts
│   │   │   │   ├── insights.ts
│   │   │   │   ├── overview.ts
│   │   │   │   ├── rankings.ts
│   │   │   │   ├── recalculate.ts
│   │   │   │   ├── reset.ts
│   │   │   │   └── trends.ts
│   │   │   ├── memes
│   │   │   │   └── hard-delete.ts
│   │   │   ├── ai-categorise.ts
│   │   │   ├── ai-comparison.ts
│   │   │   ├── ai-stats.ts
│   │   │   ├── memes.ts                              # GET/POST/PATCH/DELETE /api/admin/memes
│   │   │   ├── sql.ts
│   │   │   ├── sync-r2.ts                            # POST /api/admin/sync-r2 (R2→D1 sync)
│   │   │   └── upload.ts                             # POST /api/admin/upload
│   │   ├── ai-judge
│   │   │   ├── run
│   │   │   │   ├── progress.ts
│   │   │   │   ├── start.ts
│   │   │   │   └── stop.ts
│   │   │   ├── classify.ts
│   │   │   ├── config.ts
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   ├── next-meme.ts
│   │   │   └── runs.ts
│   │   ├── analytics
│   │   │   ├── ai-insights.ts
│   │   │   ├── audience.ts
│   │   │   ├── content.ts
│   │   │   ├── events.ts
│   │   │   ├── funnel.ts
│   │   │   ├── overview.ts
│   │   │   ├── retention.ts
│   │   │   └── trends.ts
│   │   ├── cat
│   │   │   ├── admin                                 # Admin dashboard
│   │   │   │   ├── force-removals.ts
│   │   │   │   ├── reset.ts
│   │   │   │   └── users.ts
│   │   │   ├── analytics
│   │   │   │   ├── confirm.ts
│   │   │   │   ├── memes.ts                          # GET/POST/PATCH/DELETE /api/admin/memes
│   │   │   │   └── overview.ts
│   │   │   ├── meme
│   │   │   │   └── [memeId].ts
│   │   │   ├── decide.ts
│   │   │   ├── force-remove.ts
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   ├── me.ts
│   │   │   └── next.ts
│   │   ├── curate
│   │   │   ├── super
│   │   │   │   ├── bulk-resolve.ts
│   │   │   │   ├── export.ts
│   │   │   │   ├── memes.ts                          # GET/POST/PATCH/DELETE /api/admin/memes
│   │   │   │   ├── resolve.ts
│   │   │   │   └── summary.ts
│   │   │   ├── account.ts
│   │   │   ├── ai-presets.ts
│   │   │   ├── ai-proxy.ts
│   │   │   ├── approve.ts
│   │   │   ├── export.ts
│   │   │   ├── force-remove.ts
│   │   │   ├── list.ts
│   │   │   ├── next.ts
│   │   │   ├── nsfw.ts                               # PATCH /api/curate/nsfw — Curator NSFW flag toggle
│   │   │   ├── save.ts
│   │   │   └── stats.ts
│   │   ├── memes
│   │   │   └── random.ts
│   │   ├── contact.ts
│   │   ├── daily-meme.ts                             # GET /api/daily-meme — public
│   │   ├── events.ts
│   │   ├── like.ts
│   │   ├── likes.ts
│   │   ├── random-meme.ts                            # GET /api/random-meme — public
│   │   └── report.ts
│   └── reports.ts
├── functions-dist
│   └── index.js
├── public                                            # Static assets served directly
│   ├── _headers                                      # Cloudflare Pages custom headers
│   ├── icon.svg                                      # PWA icon
│   ├── manifest.webmanifest                          # PWA manifest
│   └── sw.js                                         # Service worker for offline support
├── src                                               # Frontend source code
│   ├── admin                                         # Admin dashboard
│   │   ├── ai
│   │   │   ├── aiApi.ts
│   │   │   ├── AiComparison.tsx
│   │   │   ├── AiOverrideDrawer.tsx
│   │   │   ├── AiOverview.tsx
│   │   │   ├── AiTab.tsx
│   │   │   └── categories.ts
│   │   ├── analytics-dashboard
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── InsightsList.tsx
│   │   │   ├── MemeDetail.tsx
│   │   │   ├── Overview.tsx
│   │   │   ├── Rankings.tsx
│   │   │   └── TrendChart.tsx
│   │   ├── sql-runner
│   │   │   └── SqlRunner.tsx
│   │   ├── admin.css                                 # Admin-specific styles
│   │   ├── AdminApp.tsx                              # Admin UI component
│   │   └── AdminGate.tsx
│   ├── ai-judge
│   │   ├── aiJudge.css
│   │   ├── aiJudgeApi.ts
│   │   └── AiJudgeApp.tsx
│   ├── analytics
│   │   ├── analyticsFlush.ts
│   │   ├── analyticsQueue.ts
│   │   ├── analyticsTypes.ts
│   │   ├── deviceId.ts
│   │   ├── index.ts
│   │   └── useAnalytics.ts
│   ├── categorise
│   │   ├── superadmin
│   │   │   ├── CategoryDistribution.tsx
│   │   │   ├── ForceRemovalAudit.tsx
│   │   │   ├── JudgeProgress.tsx
│   │   │   ├── MemeComparisonTable.tsx
│   │   │   └── SuperDashboard.tsx
│   │   ├── cat.css
│   │   ├── catApi.ts
│   │   ├── CatApp.tsx
│   │   ├── CatComplete.tsx
│   │   ├── CatInterface.tsx
│   │   ├── CatLogin.tsx
│   │   ├── catTypes.ts
│   │   └── useCatAuth.ts
│   ├── components
│   │   └── AutoRefreshControl.tsx
│   ├── curate
│   │   ├── ai-judge
│   │   │   ├── aiJudgeClient.ts
│   │   │   ├── AiJudgeConsole.tsx
│   │   │   ├── aiJudgePrompt.ts
│   │   │   ├── aiJudgeTypes.ts
│   │   │   └── useAiJudgeLoop.ts
│   │   ├── analytics-preview
│   │   │   └── AnalyticsPreviewPage.tsx
│   │   ├── super
│   │   │   ├── curateSuperApi.ts
│   │   │   ├── CurateSuperDashboard.tsx
│   │   │   ├── CuratorComparisonTable.tsx
│   │   │   └── CuratorResolveModal.tsx
│   │   ├── AiPreJudgePanel.tsx
│   │   ├── AiReviewPanel.tsx
│   │   ├── CategorizationPanel.tsx
│   │   ├── curate.css
│   │   ├── CurateAccountModal.tsx
│   │   ├── curateApi.ts
│   │   ├── CurateApp.tsx
│   │   ├── CurateLogin.tsx
│   │   ├── curateTypes.ts
│   │   ├── CurationStatsModal.tsx
│   │   └── EditorialButtons.tsx
│   ├── data                                          # Static data
│   │   └── fallbackMemes.ts                          # Static fallback memes for offline/empty DB
│   ├── lib                                           # Utility modules
│   │   ├── adminApi.ts                               # Frontend → admin API client
│   │   ├── adminCollection.ts                        # Local admin collection (localStorage)
│   │   ├── localState.ts                             # Local device state (favorites, LOLs)
│   │   └── memeApi.ts                                # Frontend → public meme API client
│   ├── base.css
│   ├── main.tsx                                      # React entry point and router
│   ├── types.ts                                      # TypeScript type definitions (Meme, Rarity, etc.)
│   └── vite-env.d.ts                                 # Vite environment type augmentation
├── tests
│   └── curationConsensus.test.mjs
├── workers
│   └── analyticsAggregator.ts
├── .dev.vars.example                                 # Environment variable template
├── .DS_Store
├── .gitignore                                        # Git ignore rules
├── AGENT_RULES.md
├── AGENTS.md
├── FORCE_REMOVE_IMPLEMENTATION.md
├── FORCE_REMOVE_TODO.md
├── index.html                                        # HTML entry point
├── package-lock.json                                 # Locked dependency tree
├── package.json                                      # Dependencies and scripts
├── skills-lock.json
├── stitch_admin.html
├── tsconfig.functions.json
├── tsconfig.json                                     # TypeScript configuration
├── vite.config.ts                                    # Vite build configuration
└── wrangler.toml                                     # Cloudflare Workers/Pages config (NEW — Phase 2)
```
<!-- DIRECTORY_MAP_END -->


## Key Components and How They Interact

### Frontend (src/)

| File | Role | Talks To |
|---|---|---|
| `App.tsx` | Main meme capsule UI — spawn button, reveal animation, share/save actions | `memeApi.ts` |
| `main.tsx` | Entry point — renders App or AdminApp based on URL path | `App.tsx`, `AdminApp.tsx` |
| `memeApi.ts` | Fetches memes — tries local admin drafts → API → fallback | `adminCollection.ts`, `/api/random-meme`, `fallbackMemes.ts` |
| `adminApi.ts` | Calls admin backend routes for CRUD and upload | `/api/admin/memes`, `/api/admin/upload` |
| `adminCollection.ts` | Manages admin draft memes in browser localStorage | `localStorage` |
| `share.ts` | Native share sheet and download/save functionality | Browser APIs |
| `localState.ts` | Local favorites and LOL reaction state | `localStorage` |

### Backend (functions/)

| File | Route | Role | Talks To |
|---|---|---|---|
| `random-meme.ts` | `GET /api/random-meme` | Returns one random active meme | D1 database → fallback memes |
| `daily-meme.ts` | `GET /api/daily-meme` | Returns the daily curated pick | D1 database → fallback memes |
| `admin/memes.ts` | `GET/POST/PATCH/DELETE /api/admin/memes` | Admin CRUD for meme metadata | D1 database |
| `admin/upload.ts` | `POST /api/admin/upload` | Uploads image/video to R2 storage | R2 bucket |
| `admin/sync-r2.ts` | `POST /api/admin/sync-r2` | Scans R2 and creates D1 records for untracked files | R2 bucket → D1 database |
| `_shared/d1r2.ts` | (shared module) | D1 queries, R2 helpers, auth, fallback logic | D1, R2, fallback memes |
| `memes/random.ts` | `GET /api/memes/random` | Returns one random active meme (accepts `?nsfw=1` or `true`) | D1 database → fallback memes |
| `curate/nsfw.ts` | `PATCH/POST /api/curate/nsfw` | Curator NSFW flag toggle (`is_nsfw = 1/0`, `nsfw_flagged_by = 'curator'`) | D1 database |

### Data Flow

```
User taps "Spawn a Random Meme"
  │
  ├── [Dev mode] Check localStorage for active admin drafts
  │     └── Found? Return it immediately
  │
  ├── [Production] GET /api/random-meme
  │     └── Cloudflare Function → D1 query (active memes) → return one
  │           └── D1 empty/error? Return bundled fallback meme
  │
  └── [Offline] Return bundled fallback from src/data/fallbackMemes.ts
```

```
Admin uploads a meme
  │
  ├── POST /api/admin/upload (file → R2 bucket)
  │     └── Returns: { url, storage_path, media_type }
  │
  └── POST /api/admin/memes (metadata → D1)
        └── Sets status='draft', is_active=0 until manually activated
```

```
Admin clicks "Sync R2 Files to D1"
  │
  └── POST /api/admin/sync-r2
        ├── Lists all files in R2 bucket
        ├── Checks which files have no D1 record
        └── Creates D1 rows for missing files (status='active', is_active=1)
```

## Infrastructure

| Service | Purpose | Free Tier |
|---|---|---|
| Cloudflare Pages | Host the PWA (HTML/CSS/JS) | Unlimited sites, 500 builds/month |
| Cloudflare Pages Functions | Serverless API routes | Unlimited requests |
| Cloudflare D1 | SQLite database for meme metadata | 5 GB, 5M reads/day |
| Cloudflare R2 | Object storage for meme files | 10 GB, zero egress fees |

## Scripts

| Command | What It Does |
|---|---|
| `npm.cmd install` | Install all dependencies |
| `npm.cmd run dev` | Start local Vite dev server (frontend only) |
| `npm.cmd run build` | Build production bundle to `dist/` |
| `npm.cmd run preview` | Preview production build locally |
| `npx wrangler pages dev dist` | Run with D1 + R2 bindings locally |
