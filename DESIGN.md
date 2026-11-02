---
name: ShotDesk
description: A focused desktop workspace for screenshot libraries
colors:
  graphite-ground: "#171a1f"
  graphite-sidebar: "#191c21"
  graphite-panel: "#1d2127"
  graphite-raised: "#22272e"
  seam: "#30363e"
  ink: "#e4e8ee"
  secondary-ink: "#929ba8"
  focus-blue: "#83b7ff"
  indexing-amber: "#f1bd63"
  success-green: "#80c8a4"
typography:
  display:
    fontFamily: "Segoe UI Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.7px"
  body:
    fontFamily: "Segoe UI Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Cascadia Code, Consolas, Liberation Mono, monospace"
    fontSize: "9px"
    fontWeight: 400
rounded:
  xs: "3px"
  sm: "5px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "#d6e6fa"
    textColor: "#19222e"
    rounded: "{rounded.sm}"
    height: "34px"
    padding: "0 12px"
  search-field:
    backgroundColor: "#1d2228"
    textColor: "#e3e8ef"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 10px"
  panel:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: ShotDesk

## Overview

**Creative North Star: “The Graphite Contact Sheet.”**

ShotDesk uses the calm density of a screenshot workbench: the shell stays quiet, captures carry the visual interest, and metadata appears only where it helps retrieval. The graphite palette and hairline divisions were observed in the first Windows desktop preview. The interface is designed for long-running desktop use and remains intentionally legible over decorative.

Its signature is an image-first contact sheet with a persistent detail panel. Search and indexing status retain familiar desktop affordances; selected captures reveal file context without concealing the library.

**Key Characteristics:**
- Graphite surfaces separated by fine seams rather than heavy shadows.
- Blue is reserved for focus and selected captures; amber communicates active work or attention.
- Screenshots lead; names, dates, sizes, and paths provide compact context.
- System UI type keeps controls native-feeling; monospace is reserved for paths and counts.

## Colors

The restrained palette uses cool graphite neutrals with blue for interaction and warm amber for active processing.

### Primary
- **Focus Blue** (#83b7ff): Keyboard focus, selected captures, and active navigation details.
- **Indexing Amber** (#f1bd63): Background work and attention states.

### Secondary
- **Success Green** (#80c8a4): Completed indexing and privacy confirmation.

### Neutral
- **Graphite Ground** (#171a1f): Main application canvas.
- **Graphite Sidebar** (#191c21): Persistent navigation region.
- **Graphite Panel** (#1d2127): Search and progress surfaces.
- **Raised Graphite** (#22272e): Nested controls and selected work areas.
- **Seam** (#30363e): Hairline panel borders and dividers.
- **Primary Ink** (#e4e8ee): Main readable text.
- **Secondary Ink** (#929ba8): Supporting text and metadata.

### Named Rules
**The Status Color Rule.** Blue indicates focus or selection; amber indicates ongoing work; green confirms completion. Do not use them as decoration.

## Typography

**Display Font:** Segoe UI Variable with Inter and system UI fallbacks.\
**Body Font:** Segoe UI Variable with Inter and system UI fallbacks.\
**Label/Mono Font:** Cascadia Code, Consolas, or Liberation Mono for paths, counts, and compact technical metadata.

**Character:** Compact desktop UI typography with restrained headline scale. Tabular information is small but paired with clear contrast and spacing.

### Hierarchy
- **Display** (600, 23px, 1.2): Main page titles.
- **Headline** (600, 16px): Empty-state titles and high-level section headings.
- **Title** (600, 12px): Panel and item headings.
- **Body** (400, 13px, 1.5): Default interface text.
- **Label** (400–600, 8–10px): Counts, file types, and compact metadata; monospace only where data benefits from fixed-width figures.

### Named Rules
**The Data-Only Mono Rule.** Use monospace for paths, counts, and machine-like values; never apply it to ordinary interface prose.

## Layout

The desktop shell is a persistent left navigation, a flexible central work area, and an optional right detail panel. At the observed 1280px window width, the navigation rail is 238px and the detail panel is 302px; the work area owns remaining space. The library places search and indexing status above an image-first grid. Grid/list switching and a folder-management screen preserve familiar desktop behavior. Compact groups use an 8px rhythm with larger gaps between work areas. The desktop preview has a minimum window width of 880px; responsive behavior below that size remains to be validated.

## Elevation & Depth

Depth is conveyed by tonal steps and 1px seams rather than card shadows. Selected controls strengthen their border or surface; avoid floating layers unless a real desktop interaction requires them.

### Named Rules
**The Hairline Separation Rule.** Prefer a fine seam or one tonal step to shadowed containers.

## Shapes

Controls and panels use tight, restrained corners (3–8px) suited to a working desktop tool. Use small radii for tags and shortcuts, and 5–6px for primary controls and panels. Avoid pill-shaped containers except where a status chip needs a compact capsule.

## Components

### Buttons
- **Primary:** Pale blue-gray surface with dark text, a fine matching border, and compact horizontal padding (12px).
- **Hover / Focus:** Brighten the surface on hover; maintain a visible blue keyboard focus ring.
- **Secondary / Ghost:** Graphite surface or transparent shell with a seam border; raise contrast on hover.

### Chips
- **Style:** Compact label on a graphite surface with a subtle seam.
- **State:** Blue is reserved for selected or focused items; amber is reserved for active indexing.

### Cards / Containers
- **Background:** Graphite panel or raised graphite according to hierarchy.
- **Border:** One-pixel seam at rest; selected capture uses a blue outline.
- **Internal Padding:** 10–14px for utility panels; image metadata sits directly below thumbnails.

### Inputs / Fields
- **Style:** Graphite inset with a one-pixel seam and compact padding.
- **Focus:** Blue outline and a restrained focus halo.
- **Error / Disabled:** Keep the control geometry; lower emphasis only for disabled future-preview settings and show why it is unavailable.

### Navigation
- **Style:** Persistent, left aligned, icon plus label. Selected items use a graphite-raised background and fine border; counts align to the trailing edge. Unavailable preview modules use a quiet “SOON” badge rather than a misleading zero count. Folder rows open a library filtered to that folder and its descendants.

### Capture Contact Sheet
Thumbnails stay image-first, with a small file-type badge at the lower edge and filename/date/size underneath. Selection is expressed through a blue outline. The list view keeps thumbnails visible while placing filename and metadata on one scan line.

## Do's and Don'ts

### Do:
- **Do** reserve accent colors for focus, selection, progress, and completion states.
- **Do** preserve a clear empty-library state and show indexing counts without blocking the main workspace.
- **Do** keep image originals at their chosen paths; indexing and thumbnail generation are local.
- **Do** use translated UI strings and allow labels to grow in width.

### Don't:
- **Don't** decorate neutral surfaces with accent color that carries no state meaning.
- **Don't** replace screenshot content with generic placeholder cards in the working library.
- **Don't** imply OCR search is available until an OCR engine is connected and its output is indexed.
