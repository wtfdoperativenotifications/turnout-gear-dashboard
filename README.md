# WTFD Turnout Gear Management — Version 31

A standalone Cloudflare Worker + React application using the existing OperativeIQ turnout-gear preview source.

## Version 12 features

- Today's operational inspection briefing
- Command readiness roster
- Two-coat/two-pant member compliance
- Clickable member PPE profiles
- Inspection status and retirement timeline per assigned item
- Search and filters by gear type and location
- Exact `Turnout Gear Warehouse` recognition
- Warehouse inventory by gear type and size
- Five-year replacement budget estimates with editable assumptions
- Decommission forecast and ranked replacement priorities
- Data Explorer for source troubleshooting

## Deployment

Commit the repository to the GitHub branch connected to Cloudflare Workers Builds. No new variables or secrets are required.


## Version 12 warehouse identification

- Recognizes the exact OperativeIQ physical location `Turnout Gear Supply Warehouse`.
- Physical location overrides any stale Crew Member assignment for warehouse classification.
- Includes every active Turnout Gear subcategory, including coats, pants, boots, helmets, hoods, gloves, and other PPE.
- Warehouse inventory is grouped by gear type and size when available.


## Version 12

Dashboard metric cards now drill directly into filtered inspection, readiness, and warehouse views.
