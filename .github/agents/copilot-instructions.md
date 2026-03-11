# IronwallSky Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- localStorage / IndexedDB (device-local: high scores, streak, daily-challenge state) (001-sky-defense-core)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (main)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (main)
- TypeScript 5.6, ES2022 target + Phaser 3.80, Capacitor 6.2, vite-plugin-pwa 1.2 (main)
- localStorage + IndexedDB (client-side only) (main)
- Groovy (Gradle DSL); GitHub Actions YAML + Android Gradle Plugin (AGP ≥ 8.x via Capacitor 6); GitHub Actions `actions/upload-artifact@v4` (docs/security-vulnerability-remediation-plan)

- TypeScript 5.x (strict mode) + Phaser 3 (2D engine), Capacitor (native shell), Vite (bundler) (001-sky-defense-core)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- docs/security-vulnerability-remediation-plan: Added Groovy (Gradle DSL); GitHub Actions YAML + Android Gradle Plugin (AGP ≥ 8.x via Capacitor 6); GitHub Actions `actions/upload-artifact@v4`
- main: Added TypeScript 5.6, ES2022 target + Phaser 3.80, Capacitor 6.2, vite-plugin-pwa 1.2
- main: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
