# Keyframe · 2D Animation Studio

A browser-first 2D animation editor with a Blender-inspired workspace, layer stack, exposure timeline, transform keyframes, onion skins, shape tools, camera workspace and Grease Pencil 3D view.

## Run

No package install or build step is required. Open the GitHub Pages site or serve this folder with any static web server. The project uses native JavaScript ES modules.

## Architecture

- \`src/core/model.js\`: project schema, layer defaults, drawing exposure, animation transforms and keyframes.
- \`src/core/history.js\`: undo/redo snapshots.
- \`src/core/renderer.js\`: canvas drawing, shape rendering, onion-skin hints, selection and hit testing.
- \`src/core/export.js\`: PNG export, browser WebM capture and optional FFmpeg.wasm MP4 encoding.
- \`src/app.js\`: UI wiring, editor modes, pointer interactions, timeline and browser autosave.
- \`src/modes/grease-pencil-mode.js\`: the existing 3D Grease Pencil workspace integrated into the rebuilt shell.

## Current editor features

- Pencil, eraser, line, rectangle, ellipse, selection, fill and edit-point tools.
- Layer add/remove/reorder, visibility, opacity, blend mode and layer names.
- Frame timeline, drawing exposures, transform keyframes, playback, onion-skin toggle and FPS settings.
- Local autosave, JSON project open/save, PNG frame export, WebM animation export and optional MP4 encoding.
- Camera controls and a 3D Grease Pencil workspace with navigation, camera path and depth tools.

## Notes

This is a staged rebuild, not a claim of full Blender parity. The current version focuses on stable application structure and the common 2D-animation loop. Some advanced Blender features still need dedicated implementations and end-to-end browser testing. The FFmpeg.wasm MP4 export requires network access to load its optional encoder.
