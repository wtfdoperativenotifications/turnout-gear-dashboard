# Version 18 — Exact OperativeIQ Supply-Part Filtering

- Includes only records where OperativeIQ Asset Type equals `Supply Part`.
- Requires Category to equal `Turnout Gear`.
- Requires the record to be active and associated with Turnout Gear Supply Warehouse.
- Fixed assets, tools, and other categories are excluded regardless of words in their descriptions.
- The quantity-field mapping probe remains available because the current catalog endpoint does not expose on-hand balance.
