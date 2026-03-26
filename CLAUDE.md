# babytalk

## gstack

This project has [gstack](https://github.com/garrytan/gstack) installed as a per-project skill in `.claude/skills/gstack/`.

`/browse` handles all web browsing — never use `mcp__claude-in-chrome__*` tools.

### Available skills

**Discovery & Planning:** `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`

**Implementation & Review:** `/review`, `/investigate`, `/design-review`

**Testing & Deployment:** `/qa`, `/qa-only`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`

**Support:** `/browse`, `/cso`, `/document-release`, `/retro`, `/setup-browser-cookies`, `/codex`

**Power Tools:** `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/autoplan`, `/setup-deploy`, `/gstack-upgrade`

## Design Context

See `.impeccable.md` for the full design context. Key principles:

### Brand Personality
**Minimal, smart, serene.** Relief, not software. A calm, competent companion for exhausted new parents.

### Aesthetic Direction
**Soft & organic** — rounded shapes, warm neutrals, gentle transitions, generous whitespace. References: Apple Health/Oura + Calm/Headspace.

### Design Principles
1. **One-hand, one-glance** — Thumb-completable, scannable in 2 seconds
2. **Calm over clever** — Stillness over animation, whitespace over content
3. **Soft precision** — Warm palette, rigorous craft
4. **Context-aware kindness** — Adapts to the moment (darker at night, quieter during sleep)
5. **Invisible infrastructure** — Optimistic UI, no loading spinners, no waiting

### Accessibility
- WCAG AA baseline, one-handed use priority (44px+ touch targets), low-light optimized dark mode, reduced motion respected
