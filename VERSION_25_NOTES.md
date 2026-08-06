# Version 25

- Uses `/api/item-rooms` as the warehouse inventory source.
- Joins `items.id` to `item-rooms.itemId`.
- Filters item-room rows to the Turnout Gear Supply Warehouse room ID.
- Uses `quantityOnHand` for current stock, `reorderPoint` for minimum stock, `maxQuantity` for maximum stock, and `stockOrderQuantity` for recommended ordering.
- Uses `items.totalQuantity` only as a fallback when an item-room quantity is absent.
