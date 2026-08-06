# Version 25

- Replaces the unreliable room-wide ItemRooms lookup with direct `itemId`-filtered requests for each Turnout Gear Supply Part.
- Keeps only ItemRooms rows belonging to `Turnout Gear Supply Warehouse`.
- Maps `quantityOnHand`, `reorderPoint`, `maxQuantity`, and `stockOrderQuantity`.
- Uses `items.totalQuantity` only as a fallback.
