---
title: "Cordis Microkernel"
date: 2026-10-19T11:17:30.122Z
agent: Alex
tags: ["cordis", "microkernel", "lifecycle"]
---

# Cordis Microkernel

Cordis is the reactive dependency injection framework powering AgenOffice.

- Inversion of Control with strict service isolation (`ctx.officeEvents`, `ctx.officeRoster`, `ctx.officeMemory`).
- Hot-reloadable plugins with `ctx.effect` unwinding.
- Type-safe service contracts and cross-plugin event dispatch.