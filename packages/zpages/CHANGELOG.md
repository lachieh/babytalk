# @babytalk/zpages

## 0.0.1

### Patch Changes

- b704a42: Initial release

  - Add `@babytalk/standard-config` package with schema-validated config loading, file discovery, env var overlay, code generation, unplugin bundler plugins, CLI, and `/.well-known/config` route handler
  - Replace raw `process.env` access in API and web apps with typed config via standard-config
  - Switch all library packages from tsc to Vite 8 library builds
  - Drop `.js` extensions from all imports (Bundler module resolution)
