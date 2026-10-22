---
name: fill-forms
description: "Navigates to web application portals and systematically fills multi-input forms."
category: "Web Automation"
agent: "Kai"
version: 1
tools: ["browser_navigate", "browser_type", "browser_click", "browser_screenshot"]
---

# fill-forms

**Category**: Web Automation  
**Agent**: Kai  

## Description
Navigates to web application portals and systematically fills multi-input forms.

## Capabilities
- Systematic task automation
- Self-verifying procedure

## Procedure
1. Navigate to target URL via browser_navigate.
2. Locate form input selectors and type required field values with browser_type.
3. Submit form using browser_click.
4. Inspect page state and capture screenshot artifact.

## Required Tools
- `browser_navigate`
- `browser_type`
- `browser_click`
- `browser_screenshot`
