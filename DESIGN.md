---
version: alpha
name: SyndicPro
description: UI portée depuis syndicpro---condominium-management — glass, mesh pastel, blue/indigo
colors:
  primary: "#2563eb"
  background: "#f4f7fb"
  foreground: "#0f172a"
  accent: "#2563eb"
  accent-strong: "#1d4ed8"
typography:
  sans:
    fontFamily: Plus Jakarta Sans
  mono:
    fontFamily: JetBrains Mono
---

## Overview

UI aligned to the Vite redesign (`syndicpro---condominium-management`): soft pastel mesh ambient blobs, glass cards/nav, Plus Jakarta Sans, blue→indigo primary CTAs, sidebar with Navigation + Raccourcis, top bar with greeting / residence picker / ⌘K search / theme toggle.

## Surfaces

- `.glass-card` / `.sp-card` — frosted white panels
- `.glass-nav` — sidebar + sticky header
- `.sp-ambient` — fixed mesh gradient blobs behind content

## Components

- Primary button: gradient `from-blue-600 to-indigo-600`
- Active nav: `bg-blue-600/10` + blue border tint
- Page headers: blue uppercase eyebrow + extrabold title
