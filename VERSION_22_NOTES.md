# Version 21 — Optimized Supply Quantity Join

- Reduces the preview Worker supply inventory request to four single-page OperativeIQ calls.
- Finds the `Turnout Gear Supply Warehouse` room and `Turnout Gear` category first.
- Requests only item-room batches for the warehouse and items for the category.
- Sums `currentQty` by `itemId`; `receivedQty` is not used as on-hand inventory.
- Adds diagnostics showing resolved room/category IDs, requested filtered endpoints, loaded row counts, and matched inventory rows.
- Updates the dashboard version label to Version 21.
