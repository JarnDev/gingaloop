# Contributing

Thanks for helping! The most valuable contributions are **language profiles** and improvements to the
generation prompts.

## Development

```sh
git clone https://github.com/JarnDev/gingaloop && cd gingaloop
npm test                      # unit tests (no Docker needed)
npm run check:examples        # validates every built-in example in the sandbox (needs Docker)
node bin/ginga.mjs --help
```

No runtime dependencies and no build step: plain ESM JavaScript with JSDoc, Node ≥ 22.18. Please
keep it that way.

## Adding a built-in language profile

1. Bootstrap one in a scratch workspace: `ginga lang add <language>`. Claude drafts
   `profiles/<id>.json` plus a reference example, and it's accepted only if the example validates.
2. Copy `profiles/<id>.json` into this repo's `profiles/`, and the example into `examples/<id>/`.
3. Review it by hand. This matters more than the generation:
   - the image is a **Docker Official Image** pinned to a tag (or a minimal Dockerfile on one);
   - tests use the language's standard tooling, no package installs, and work with a read-only root
     filesystem (HOME and caches under `/tmp`);
   - each bug variant fails **on the right test** and represents a mistake people really make;
   - the README examples and explanation numbers are real (run them).
4. `node bin/ginga.mjs validate examples/<id> --lang <id>` must pass.

## Principles

- Generated code never runs on the host. Anything that executes goes through `src/sandbox.mjs`.
- The runner knows no languages. Language knowledge lives in profiles and prompts, not in code.
- Be honest in docs: the solution lock is friction, not security.
