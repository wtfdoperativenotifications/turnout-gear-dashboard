# Version 16 — Asset and Supply Inventory Testing Release

## Version 15 completion
- Combines redundant Assigned To and Current Location columns into one Assignment / Location column.
- Keeps gear type and size inside the Asset cell.
- Correct version label and Logistics Division header.
- Member status filters, size summaries, corrected asset tag/serial/manufacturer/model fields, clickable readiness cards, and annual inspection logic limited to coats and pants.

## Version 16 supply inventory
- Adds a Supply Inventory page for quantity-based OperativeIQ parts such as leather gloves and hoods.
- Adds live SKU, on-hand, minimum, maximum, size, location, manufacturer, and stock-status fields when exposed by OperativeIQ.
- Adds in-stock, near-minimum, low-stock, out-of-stock, and quantity-unavailable filters.
- Adds /api/supplies and derives the preview source from /preview-supply-inventory without new Cloudflare variables.
- Includes a read-only OperativeIQ preview Worker route and probe route for supply inventory discovery.

Deploy the Operative preview Worker update first, then deploy the turnout gear dashboard.
