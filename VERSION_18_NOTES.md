# Version 17 — Supply Field Mapping and Catalog Review

## Purpose
This diagnostic release maps OperativeIQ supply inventory fields before service testing and removes obvious non-inventory false positives.

## Changes
- Adds a read-only Supply Quantity Field Mapping panel.
- Probes likely OperativeIQ inventory endpoints and reports HTTP status, row counts, all field paths, sample values, and likely numeric quantity fields.
- Searches nested objects for quantity values.
- Adds additional quantity aliases such as `qty`, `balance`, `currentStock`, `stockOnHand`, `inventoryQuantity`, and `warehouseQuantity`.
- Adds configurable supply include/exclude patterns.
- Default exclusion removes tools, forms, service/repair records, test/training items, and similar non-stock records; for example `Hood Tool` is excluded.
- Displays automatically excluded items for review.

## Optional Cloudflare variables
No new variable is required. The defaults may be overridden later:

- `SUPPLY_INCLUDE_PATTERN`
- `SUPPLY_EXCLUDE_PATTERN`

Both values are case-insensitive regular-expression text.
