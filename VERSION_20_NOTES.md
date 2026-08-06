# Version 19 — Supply Room Inventory Join

- Uses `/api/items` for supply-part catalog records.
- Uses `/api/item-rooms` and `/api/item-room-batches` for room assignment and quantity.
- Prefers `/api/supply-rooms/room-parts-for-cycle-counting` when available.
- Joins `/api/supply-rooms`, `/api/categories`, `/api/sub-categories`, `/api/manufacturers`, `/api/uoms`, and `/api/stock-locations`.
- Includes only active Supply Parts in Category `Turnout Gear` located in `Turnout Gear Supply Warehouse`.
- All routes remain read-only.
