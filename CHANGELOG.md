# Changelog

Todas las modificaciones relevantes de Medical OS se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

### R0 — Foundation (en curso)

#### Added

- **NIVEL 0 — Gobierno & repositorio**
  - Monorepo TypeScript (pnpm workspaces + Turborepo) con lint, format, typecheck y test.
  - Configuración base estricta de TypeScript (`tsconfig.base.json`).
  - ESLint 9 (flat config) con `no-explicit-any` y prohibición de `catch` vacío.
  - Prettier, EditorConfig, `.nvmrc`, `.npmrc` con `engine-strict`.
  - `.gitignore` con exclusión estricta de `.env`/secretos.
  - ADR-0001 (modular monolith), ADR-0002 (multi-tenancy), ADR-0003 (manejo de PHI).
  - Plantillas de issues: feature, bug, clinical safety, security incident, schema migration.
  - `CODEOWNERS`, Definition of Done y Release Checklist.
  - Pipeline CI (GitHub Actions): secret scan → deps/license → lint → typecheck → unit → build.
