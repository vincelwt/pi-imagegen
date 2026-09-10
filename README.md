# pi-imagegen

[![npm version](https://img.shields.io/npm/v/pi-imagegen.svg)](https://www.npmjs.com/package/pi-imagegen)
[![license](https://img.shields.io/npm/l/pi-imagegen.svg)](https://github.com/Jon-Vii/pi-imagegen/blob/main/LICENSE)

A [Pi](https://pi.dev) package for generating images with your existing OpenAI/Codex subscription session.

`pi-imagegen` adds an agent-callable `imagegen` tool, a `/img` command namespace, and a local browser studio for visual image workflows.

## What it does

- Generates images through Pi's existing `openai-codex` OAuth login.
- Falls back to other registered subscription accounts when one returns a quota limit.
- Uses the Codex Responses backend with native GPT Image 2.5 generation (`gpt-image-2.5-sunburst` at high quality by default, `gpt-image-2.5-flare` for faster everyday generation).
- Saves images and sidecar metadata locally.
- Supports batches, style presets, reference images, and sketch references.
- Provides a browser-based studio for browsing, comparing, rerunning, varying, and referencing images.

## Install

Install the published npm package:

```bash
pi install npm:pi-imagegen
```

npm package: <https://www.npmjs.com/package/pi-imagegen>

For local development:

```bash
git clone https://github.com/Jon-Vii/pi-imagegen.git
cd pi-imagegen
pi install .
```

Then reload Pi:

```txt
/reload
```

You also need to be logged into Pi's OpenAI/Codex provider:

```txt
/login
```

Select the ChatGPT/Codex option that provides the `openai-codex` provider.

## Commands

```txt
/img studio
/img gen [--model flare|sunburst|gpt-image-2] [--thinking off|minimal|low|medium|high] [--style name] <prompt>
/img batch <count> [--model flare|sunburst|gpt-image-2] [--thinking off|minimal|low|medium|high] [--style name] <prompt>
/img styles
/img list [count]
/img open [latest|number|path]
/img reveal [latest|number|path]
/img path [latest|number|path]
/img info [latest|number|path]
```

Examples:

```txt
/img gen tiny blue ceramic fish on white background
/img gen --model sunburst --quality high a product shot of a ceramic cup
/img gen --thinking off --style poster a cinematic expedition poster for a lava cavern
/img batch 4 --style wallpaper a quiet mountain observatory at sunrise
/img studio
```

## Studio

Run:

```txt
/img studio
```

The studio opens a local browser UI served from `127.0.0.1`.

It supports:

- image history wall
- grouped batch/contact-sheet view
- modal preview with rerun/vary/reference actions
- prompt composer with model, style, aspect, quality, thinking, and count controls
- real image references sent as `input_image` content
- sketch references via a simple drawing canvas

A typical loop:

```txt
Draw or pick reference → Generate 4 → inspect → Vary or Rerun → keep exploring
```

## Agent tool

The package also registers a model-facing tool:

```txt
imagegen
```

It can generate an image and return both a saved file and an inline image attachment. It supports options such as:

- `prompt`
- `imageModel` (`gpt-image-2.5-sunburst` default, `gpt-image-2.5-flare`, or `gpt-image-2`)
- `size`
- `quality` (`high` default, also `auto`, `low`, `medium`, `xhigh`, `max`)
- `background`
- `outputFormat`
- `thinking`
- `referencePaths`
- `outputPath`

## How it works

This package does **not** use the public OpenAI image API or a separate API key.

It uses Pi's existing `openai-codex` OAuth token and calls:

```txt
https://chatgpt.com/backend-api/codex/responses
```

with the native Responses image generation tool:

```json
{
  "type": "image_generation",
  "model": "gpt-image-2.5-sunburst"
}
```

Generated image results are received from streamed SSE events and saved locally.

### Multiple subscriptions

If your Pi setup registers extra subscription providers (`openai-codex-alt`,
`openai-codex-2`, `openai-codex-3`, and so on), image generation discovers them
through the model registry. The selected subscription provider is tried first,
then the primary and remaining registered accounts. Authentication is resolved
through Pi for each attempt, including normal OAuth refresh. The package does
not read or copy credential files and never falls back to a paid API key.

An initial HTTP 429 advances to the next distinct subscription, at most once per
account. Missing or unrefreshable credentials are skipped. Network errors,
other HTTP failures, cancellation, and failures after streaming starts are not
replayed, since generation may already have started. If every usable account
is limited, the tool reports pool exhaustion. Saved metadata identifies the
provider that actually generated the image. This applies to the tool, commands,
batches, and studio, without changing the conversation's selected model.

### Tests

With Node.js 22.6 or newer:

```sh
npm test
```

## Files and metadata

By default, generated images are saved under:

```txt
~/.pi/agent/generated-images/
```

Each image gets a JSON sidecar with prompt, model, path, format, reference, batch, and generation metadata.

Batches are saved under:

```txt
~/.pi/agent/generated-images/batches/
```

Sketch references are saved under:

```txt
~/.pi/agent/generated-images/sketches/
```

## Notes

This package relies on Pi internals and the Codex Responses backend. It is intended for personal/local Pi workflows and may need updates if the upstream backend changes.

## License

MIT
