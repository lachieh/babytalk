# babytalk

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

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
