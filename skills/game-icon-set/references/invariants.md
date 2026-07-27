# Ready-to-use prompt blocks

Copy these verbatim. Fill only `{SUBJECT}` and `{MATTE}`.

## Contents

- [1. Type A — isolated object](#1-type-a--isolated-object)
- [2. Type B — fills the frame](#2-type-b--fills-the-frame)
- [3. Emissive override](#3-emissive-override)
- [4. Geometry-reference override](#4-geometry-reference-override)
- [5. Illustration class](#5-illustration-class)
- [6. Matte colour table](#6-matte-colour-table)
- [7. Model-specific settings](#7-model-specific-settings)

---

## 1. Type A — isolated object

The default. Object on a keyable matte, composited onto a vector plate.

```
3D rendered game UI symbol, physically based rendering, clean simple form, restrained and functional rather than decorative.

REFERENCE: IMAGE 1 is the style anchor for this entire set. Match its rendering, lighting direction, material finish, contrast level and colour treatment exactly. Only the depicted object differs.

SUBJECT: {SUBJECT}

Material: PBR shading, semi-matte surface with medium-high roughness, soft controlled specular highlights, subtle ambient occlusion in crevices. No wet gloss, no mirror finish.

Lighting: one key light from the upper left at a 45 degree angle, soft low-intensity fill from the lower right, cool desaturated rim light along the top right edge. No other light sources, no coloured gels. Identical lighting setup in every image of this set.

Camera: orthographic front view, straight on, no perspective distortion, no tilt, object centred and filling roughly 75 percent of the canvas.

Detail level: shape the object with large primary forms only. No fine surface detail, no small parts, no wear, scratches or panel lines. Any feature too small to survive at {DISPLAY_SIZE} must be omitted rather than rendered.

Restraint: render exactly what SUBJECT describes and nothing more. Exactly one object unless SUBJECT states a count. No gems, jewels, crystals, ornaments, engravings, inscriptions, splashes, sparks, particles, smoke or decorative additions. Nothing that is not explicitly named in SUBJECT may appear.

Background: one perfectly flat, evenly lit, solid {MATTE} field filling the entire frame, completely uniform in colour, with no gradient, no vignette, no texture, no grain, no pattern and no checkerboard. A plain matte colour field and nothing else.

Separation: the object must not reflect, refract or pick up any colour from the background, and must cast no shadow onto it. Keep the object's outline hard and clearly defined, with no glow, no bloom, no haze, no depth of field and no motion blur at its edges. Nothing in the corners of the frame.

Constraints: no frame, no border, no bezel, no rounded rectangle, no plaque, no badge, no panel, no background plate, no text, no letters, no numbers, no watermark.
```

## 2. Type B — fills the frame

For subjects that are a surface or a field rather than an object: flowing liquid, cracked ground, a flash, a texture.

Replace three blocks from Type A:

```
Camera: orthographic front view, straight on, flat and frontal, no perspective distortion.

Composition: the subject fills the entire square canvas edge to edge, with no empty margin and no isolated object. Nothing in the corners of the frame.

Background: the subject IS the background. No separate backdrop, no plate, no frame, no border, no vignette.
```

Composite by clipping to the plate shape, with the plate gradient underneath at Multiply 40–60%.

## 3. Emissive override

For anything that is a light source: lightning, fire, glowing eyes, energy, hot metal, scanning highlights.

Replace the Material, Lighting and Background blocks entirely:

```
Material: the object is emissive — it is a light source in itself, not a lit surface. Its core blows out to near-white along the centre of every limb and falls off through saturated colour toward the edges. A tight warm halo of light surrounds the whole shape, and short thin arcs of energy branch off from its outer edges and fade out. Hot, radiant and charged, never matte plastic.

Lighting: the object lights itself. No external key light, no fill light, no rim light. Nothing else in the frame is lit by it.

Background: pure flat black (#000000) filling the entire frame, completely uniform, with no gradient, texture or vignette. The glow is allowed to bleed into the black.
```

Composite with **Screen** or **Add**. Do not attempt to key it.

## 4. Geometry-reference override

When a second image defines pose and proportions. Replaces the REFERENCE block:

```
REFERENCE: IMAGE 1 is the style anchor for this set. Match its rendering, lighting, material finish and contrast exactly.

REFERENCE: IMAGE 2 defines the pose, proportions and outline of the subject. Reproduce that exact silhouette, stance and placement, matching its proportions precisely even where they differ from real anatomy. IMAGE 2 is a geometry guide only — do not copy its rendering, and do not treat it as a style reference.
```

Strip anything from SUBJECT that contradicts IMAGE 2 (held equipment, changed pose, added limbs). Contradictions produce a compromise matching neither.

## 5. Illustration class

For icons displayed large — skill screens, cards, tooltips. A different visual class: scene rather than symbol. Replaces the whole Type A invariant.

```
Atmospheric painted game artwork, cinematic and moody, filling the entire square frame edge to edge. Rich material texture, deep shadows, strong directional light, shallow depth of field. Photographic realism pushed toward stylised game art, not a flat symbol and not a clean studio render.

SUBJECT: {SUBJECT}

Composition: tightly cropped, the subject filling the frame with no empty margin, no isolated object floating in space and nothing in the corners.

Palette: {PALETTE}. Desaturated overall with one dominant colour carrying the mood.

Constraints: no frame, no border, no plaque, no badge, no text, no letters, no numbers, no watermark, no logo. No recognisable real person's face.
```

No matte and no keying — the background is part of the artwork. Do not audit these on the same contact sheet as symbol-class icons; the criteria differ.

## 6. Matte colour table

Maximum hue distance from the subject.

| Subject colour | {MATTE} |
|---|---|
| Reds, warms, browns | `pure saturated green (#00C000)` |
| Neutrals, greys, blacks, whites | `pure saturated green (#00C000)` |
| Greens, blues, cyans | `pure saturated magenta (#C000C0)` |
| Yellows, golds | `pure saturated magenta (#C000C0)` |
| Khaki, tan, olive | `pure saturated magenta (#C000C0)` |
| Skin tones, mixed palettes | `pure saturated blue (#0040FF)` |
| Emissive anything | black — see §3 |

Never choose a matte in the subject's own hue family.

## 7. Model-specific settings

### Gemini / Nano Banana
No numeric weights. Attach the anchor to every request. Understands negations inside instructions. Stamps a SynthID mark in a corner — crop it.

### Midjourney
```
--sref <anchor url> --sw 250 --seed <fixed> --stylize 100 --style raw --ar 1:1
```
Ignores negations in prompt text — bans go in `--no`. `Vary (Subtle)` for touch-ups, `Upscale (Subtle)` never `Creative`.

### SD / Flux
Fix seed, checkpoint, LoRA, sampler, steps and CFG together. IP-Adapter 0.6–0.8 on the anchor. img2img denoise: 0.15–0.30 polish, 0.35–0.50 remaster, 0.55+ redraw. ControlNet canny weight 1.0 for hard geometry lock.
