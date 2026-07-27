---
name: game-icon-set
description: Produce a consistent set of game UI icons with an image model (Gemini/Nano Banana, Midjourney, SD/Flux) and composite them into a design system. Use this whenever the user wants icons, status effects, skill icons, HUD symbols, item art, or any batch of images that must look like one family — and especially when they say "make prompts for icons", "generate an icon set", "these came out inconsistent", "it doesn't match the reference", "the background isn't transparent", or when they're iterating on an icon that keeps coming back wrong. Also use when analysing tiny existing icons (16-48px) to work out what they depict, when cutting generated art out of its background, or when deciding what to generate versus what to build as vector in Figma.
---

# Game icon sets with image models

Producing one icon is easy. Producing thirty that look like one family, survive being displayed at 48px, and drop cleanly into a design system is where it goes wrong. This skill is the accumulated failure list.

## The two decisions that come before any prompt

**1. What gets generated and what gets built.**

Generate: the subject. Nothing else.

Build as vector: the backing plate, the frame, the border, the corner radius, the inner shadow, the contact shadow, any text, any per-state colour variant.

Rationale: 30 generated plates are 30 different plates. One vector plate is one plate. Colour variants become a token swap instead of a re-generation. And when the user changes the corner radius in month two, they edit one component rather than regenerate the set.

**2. What size the icon is actually displayed at.**

Ask, and take the answer seriously. It sets the detail budget:

| Display size | What survives |
|---|---|
| 16–24px | Silhouette only. One shape. |
| 32–48px | Silhouette + one internal feature + colour. |
| 64–128px | Two or three forms, material reads. |
| 256px+ | Scenes, texture, depth of field. |

Most "the icon doesn't read" complaints are a description written for 256px being displayed at 48px. Say so early rather than after twenty generations.

## The invariant pattern

Every prompt in the set is identical except one slot.

```
[MEDIUM] [REFERENCE] [SUBJECT ←only this changes] [MATERIAL]
[LIGHTING] [CAMERA] [DETAIL LEVEL] [RESTRAINT] [BACKGROUND] [CONSTRAINTS]
```

Copy the fixed blocks byte-for-byte between prompts. Do not reword them "for variety" — any rewording shifts the style.

Full ready-to-use invariant blocks: `references/invariants.md`.

### Style is held by render physics, not adjectives

`Unreal Engine style`, `AAA quality`, `cinematic` are weak tokens — the model reads them as "make it nice" and the result drifts every run. Style is held by things the model can resolve unambiguously:

- key light angle (state it in degrees)
- presence and colour of rim light
- surface roughness
- orthographic vs perspective camera
- background treatment
- contact shadow

Replace every mood word with a description of what is physically happening in the frame.

### Text-only invariants give roughly 60% consistency

The rest comes from image conditioning: `--sref` + fixed `--seed` in Midjourney, the approved anchor attached to every request in Gemini, IP-Adapter at 0.6–0.8 in SD/Flux.

## Workflow

1. **Pick an anchor.** The simplest form in the set — a cross, a bolt, a plain geometric symbol. Generate 8–12 variants of only that one, tuning the invariant until the style is right.
2. **Freeze.** The approved anchor becomes the style reference. The invariant is now closed to edits.
3. **Generate the rest**, each conditioned on the anchor. Never generate a set member from text alone — it will fall out of family.
4. **Order the queue from geometry to bodies.** Simple shapes first, hands and faces last, when the reference base is densest.
5. **Contact sheet.** All icons on one canvas at final display size. Drift and collisions are only visible side by side.
6. **Fix drift by re-generating with a stronger reference weight, not by editing the text.** Editing the text moves that icon relative to all the others.

### Pairs must be generated in one session

Icons that differ by one attribute — buff/debuff, light/heavy, broken/healed, 60%/80% — must be produced back to back. Split across sessions, the shared object is drawn differently each time and the pair collapses.

## Failure modes, in the order they bite

**"Transparent background" produces a picture of a checkerboard.** Image models have no alpha channel. Never ask for transparency. Ask for a flat solid matte, then key it.

**The word `icon` summons an app-icon frame.** It primes rounded-rect plaques and metallic bezels. Use `artwork`, `symbol`, or `graphic`. Also avoid `nothing else in the frame` — the model reads "frame" as an instruction to draw one.

**Percentages of frame coverage do not work.** The model cannot measure area; `covering 60% of the frame` reads as "some". Describe by zone and by relation to edges: "runs down the whole right side to the bottom edge", "almost touches the left and right edges", "an even margin on all four sides".

**Text in generated images is always garbage.** Any label, number, gauge marking, logo or document. Leave the surface blank in the prompt and set the text as a layer in the design tool — which also makes it localisable. Triple the ban if the object naturally carries text (thermometers, documents, packaging): `no letters, no words, no numbers`.

**The model adds ornament nobody asked for.** A palette note like "amber accent" becomes a literal amber gemstone. The fix is one clause, stronger than any list of prohibitions:

> Nothing that is not explicitly named in SUBJECT may appear in the image.

**A "no glow" invariant makes emissive subjects look like plastic.** Lightning, fire, glowing eyes and energy need the material and lighting blocks replaced, not tweaked. See the emissive override in `references/invariants.md`.

**Attaching a low-resolution source leaks its artifacts.** A 24×22 source with a frame returns a frame, in defiance of an explicit ban in the prompt. Crop the source to its content before attaching, or better, don't attach it at all — once the subject is described in text, the source adds risk and no information.

**Gemini stamps a SynthID mark in a frame corner.** Crop it. `nothing in the corners` reduces the odds but does not eliminate them.

**Aspect ratio belongs in the UI control, not the prompt text.**

## Backgrounds and extraction

Three cases. Pick by subject, not by habit.

| Subject | Background | Extraction |
|---|---|---|
| Solid opaque object | Flat saturated matte, hue-distant from the subject | Chroma key |
| Emissive / glowing | Pure black `#000000` | Screen or Add blend — no keying at all |
| Fills the whole frame | The subject is the background | Clip to the plate shape |

Matte colour is chosen for maximum hue distance from the subject: green for reds and neutrals, magenta for greens/blues/yellows, blue for mixed and skin tones. Never pick a matte in the same hue family as the subject.

Two clauses matter as much as the colour:

```
The object must not reflect, refract or pick up any colour from the background, and must cast no shadow onto it.
Keep the object's outline hard, with no glow, bloom, haze, depth of field or motion blur at its edges.
```

Without the first, a glossy subject picks up a rim of matte colour that cannot be removed afterward. Without the second, the edge is unkeyable.

**Never ask for a contact shadow in the generation.** On a matte it becomes grey sludge that breaks the key; on black it is invisible. Add it as a layer — which also makes it identical across the set.

**Emissive subjects are composited, not cut out.** Glow is semi-transparent by nature and no alpha key produces a clean halo edge. Black background + Screen blend removes the black mathematically. This is exact, requires no masking, and lets the plate show through the glow so the object sits in the frame rather than on it.

Script: `scripts/chroma_key.py`.

## Reading tiny source icons

When the reference is a 16–48px raster, do not guess what it depicts from the thumbnail — guessing wrong costs several generation rounds. Probe it.

`scripts/icon_probe.py` prints a luminance map, a saturation map and a hue map as character grids, plus connected-component analysis. From those you can reliably read:

- **Saturation ~0 across the whole icon** → it is a tintable monochrome glyph; the colour comes from the UI layer, not the asset. Do not bake the observed colour into the set.
- **Where the bright mass sits** and whether it is light-on-dark or dark-on-light. Generating a dark object when the source is a light symbol is a silent mismatch.
- **Alternating bright/dark along a scan line through the centre** → concentric rings or a spiral.
- **Separate connected components** → the source may already be segmented into zones, which can be exported directly as masks.

Be honest about the limit: below roughly 24px, shape identification is often not possible. Say so and ask the user what the icon depicts rather than inventing a metaphor. An invented metaphor that the user then rejects is the single most expensive failure in this workflow.

### Segmented sources are geometry, not just reference

If a source figure splits into separate regions (body zones, parts of a machine), invert the usual order: the segmentation becomes the authoritative geometry, and the generated art is matched to it. Then per-region overlays register pixel-perfectly and every combination of regions is free. Generating each combination separately gives figures that do not align and a UI that jitters when regions toggle.

When conditioning on a geometry reference, split the reference roles explicitly or the model will copy the reference's rendering style:

```
IMAGE 1 is the style anchor. Match its rendering, lighting, material and contrast.
IMAGE 2 defines pose, proportions and outline. Reproduce that silhouette exactly,
matching its proportions even where they differ from real anatomy. IMAGE 2 is a
geometry guide only — do not copy its rendering and do not treat it as style.
```

And strip anything from the SUBJECT that contradicts the geometry reference. Contradictory instructions produce a compromise that matches neither.

## Set-level collisions

Individually good icons collide as a set. Audit before generating, not after.

Group by silhouette class — droplets, crosses, circles, bolts, human figures, vertical containers — and check every group with more than one member. For each pair, name the single feature that distinguishes them and verify it survives the display size.

What works, in descending order of robustness:

1. **Silhouette** — broken vs whole, one part vs two, round vs angular. Survives everything.
2. **Fill state** — solid vs hollow. Robust if the opening stays large.
3. **Framing** — one eye macro vs both eyes and the bridge of the nose.
4. **Viewing angle** — front vs back vs profile. The best tool for multiple human figures.
5. **Plate colour** — works, but it is a shared channel; do not spend it twice.
6. **Internal detail** — does not survive below ~64px. Never rely on it alone.

Two anti-patterns worth naming: relying on scale alone to distinguish a pair (60% vs 80% of frame is invisible at 48px — change the camera distance so one nearly touches the edges instead), and spending a colour channel on decoration when it is needed for state (a thermometer that is red at rest cannot then encode fever).

## Reusing visual language

When a treatment already exists in the set — an x-ray look, a green scan outline, a particular glow — reuse it deliberately for related concepts. Repetition here is cohesion, not laziness. Note the shared treatment in the prompt so it is reproduced rather than reinvented.

## Source assets and originality

Do not feed the user's reference assets from a copyrighted game or product into the generation, and do not describe named characters, logos or branded designs in the prompt. Two reasons, both practical:

- The model renders logos and specific characters as garbage anyway.
- Icons generated from a written description plus the user's own style anchor are original work. Icons traced from someone else's asset are derivative, which matters if the user signs their output or ships it commercially.

Describe valuable or branded objects by form and material instead: "a thick gold coin with an embossed symbol", "a red plastic access card", "a small painted figurine of a helmeted soldier". Add `no logos, no branding, no readable text` to the prompt.

## Deliverable

A single markdown file the user keeps, containing: the invariant, the per-icon SUBJECT lines with their type and matte colour, a section listing collisions and how each is resolved, and the generation order. Keep it as one file and edit it in place as the set grows — a set that accumulates across sessions will otherwise fragment into stale versions.
