---
version: alpha
name: SyndicPro
description: PWA copropriété — bento SaaS minimal, canvas doux, accent ciel
colors:
  primary: "#0ea5e9"
  background: "#f4f5f7"
  foreground: "#0f172a"
  background-dark: "#020617"
  foreground-dark: "#f8fafc"
  accent: "#0ea5e9"
  accent-strong: "#0284c7"
  surface: "#ffffff"
  surface-muted: "#f1f2f4"
  border: "#e8eaed"
  danger: "#e11d48"
  success: "#10b981"
  warning: "#f59e0b"
typography:
  sans:
    fontFamily: Geist
  mono:
    fontFamily: Geist Mono
rounded:
  base: 1rem
  lg: 1.5rem
  xl: 1.75rem
spacing:
  page-x: 1.5rem
  page-y: 1.5rem
  touch: 2.75rem
---

## Overview

SyndicPro follows a **minimal bento SaaS** language: soft gray canvas (`#f4f5f7`), pure white elevated panels (`rounded-3xl`), soft diffuse shadows, generous padding, and a single sky accent. Large tabular KPIs, thin Lucide icons, pill actions. French, mobile-first, ≥44px targets.

## Colors

- Canvas `#f4f5f7`, surfaces white, ink slate-900.
- Accent: sky-500 / sky-600 only for primary CTAs and active cues.
- Semantic soft tints for success / warning / danger badges.
- No purple, no neon glow, no multi-stop brand gradients on chrome.

## Typography

- Geist Sans everywhere; Geist Mono for IDs.
- Page titles: large, bold, balanced. Labels: small muted.
- KPI values: `text-3xl`–`text-5xl`, `tabular-nums`.

## Layout

- Slim sidebar (~15.5rem) + optional desktop greeting bar.
- Content max-width `max-w-6xl`, bento grids with uneven spans.
- `min-h-dvh`, safe-area for fixed chrome.

## Elevation

- Cards: white + `shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]` + hairline border.
- Active nav: soft slate/sky pill, never a solid heavy block.

## Components

- Buttons: primary sky pill, secondary soft slate pill, outline hairline.
- Stat cards: label + huge value + optional trend pill + meter/spark area.
- Badges: soft tint pills.
- Empty states: one clear next action.
