---
name: knowledge-capture
description: >
  Decides when AI-discovered knowledge is worth saving to the Obsidian vault.
  Activated when the user has a persistent instruction like
  "save important concepts to my knowledge base" or
  when the MemoryWriter routes content to Obsidian.
slash_commands:
  - /save-knowledge
---

# Knowledge Capture Skill

## What this skill does

When activated, the Manager checks each completed task response and decides
whether the content contains durable knowledge worth saving to Obsidian.

This is an **optional layer on top of normal task execution**.
It does not trigger automatically on every response.

---

## What qualifies as durable knowledge

Save to Obsidian when the response contains **any of these**:

- A technical concept explained clearly (e.g. how LangGraph works, what RAG is)
- A project decision or architecture choice
- A research finding or comparison (e.g. comparing two frameworks)
- A useful code pattern or approach worth referencing later
- An important lesson learned from a failed or successful task
- A reference document summary (e.g. "here's what this paper says")
- A repeated user preference that defines how the user works

## What should NOT be saved

Do not save:

- Casual greetings or small talk
- Simple one-sentence answers to factual questions
- Debug attempts that did not produce a useful pattern
- Tasks where the output was already low quality or incomplete
- Duplicate information already well-covered in an existing note

---

## When to create a new note vs. update an existing one

**Always search before creating.**

1. Search Obsidian for notes matching the topic title.
2. If a close match exists, **append** new information to that note.
3. Only create a new note if no relevant existing note is found.
4. Never create duplicate notes covering the same concept.

---

## How to format a knowledge note

Use clean, readable Markdown. Write like a human wiki, not a chatbot.

```markdown
# [Concept Title]

Brief one-sentence summary of what this is.

## Key Points

- Point 1
- Point 2
- Point 3

## How it relates to this project

One paragraph connecting it to the Agentic AI Office or the user's work.

## Links

- [[Related Concept 1]]
- [[Related Concept 2]]
- [[Agentic AI Office]]

---
*Captured by Agentic AI Office — YYYY-MM-DD*
```

---

## How to link concepts

Always add `[[wikilinks]]` to:

- Other notes in the vault that are relevant
- Core concepts the note depends on
- The `[[Agentic AI Office]]` note if the content relates to this project

This lets Obsidian's graph view visualize relationships automatically.
Do not maintain a separate graph database for this.

---

## Slash command: /save-knowledge

When the user types `/save-knowledge`, the current task output is sent to
`POST /api/knowledge/save`. The backend generates a clean note and saves it
to the vault. The frontend shows a confirmation message with the note title.

---

## Summary

- Be selective. Quality over quantity.
- Always prefer updating an existing note over creating a duplicate.
- Keep notes short and scannable.
- Add wikilinks to build the knowledge graph naturally.
- Let Obsidian's built-in graph do the visualization work.
