---
name: extract-invoice
description: "Parses tabular invoice documents and calculates line totals with tax verification."
category: "Document Processing"
agent: "Rio"
version: 1
tools: ["file_reader", "calculator"]
---

# extract-invoice

**Category**: Document Processing  
**Agent**: Rio  

## Description
Parses tabular invoice documents and calculates line totals with tax verification.

## Capabilities
- Systematic task automation
- Self-verifying procedure

## Procedure
1. Read invoice file from workspace using file_reader.
2. Extract line items, quantities, and unit prices.
3. Compute subtotal and apply tax rate using calculator.
4. Output validated structured JSON receipt.

## Required Tools
- `file_reader`
- `calculator`
