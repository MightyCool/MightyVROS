// Copies the self-hosted MediaPipe Hands runtime (lite model only) from node_modules into public/mediapipe.
import fs from 'node:fs';
import path from 'node:path';
const src = 'node_modules/@mediapipe/hands', dst = 'public/mediapipe';
const files = [
  'hands.js', 'hands.binarypb', 'hand_landmark_lite.tflite',
  'hands_solution_packed_assets.data', 'hands_solution_packed_assets_loader.js',
  'hands_solution_simd_wasm_bin.js', 'hands_solution_simd_wasm_bin.wasm', 'hands_solution_simd_wasm_bin.data',
  'hands_solution_wasm_bin.js', 'hands_solution_wasm_bin.wasm',
];
fs.mkdirSync(dst, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log(`MediaPipe Hands: copied ${files.length} files to ${dst}`);
