:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #08131f;
  color: #f5f7fa;
}
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(circle at top, #10263a 0, #08131f 42%); min-height: 100vh; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 24px 30px; border-bottom: 1px solid #24374a; background: rgba(5, 16, 27, .92); position: sticky; top: 0; z-index: 5; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 0; font-size: clamp(1.45rem, 2.5vw, 2.25rem); }
h2 { margin-bottom: 6px; font-size: 1.1rem; }
.eyebrow { margin-bottom: 5px; color: #7fb8eb; font-size: .72rem; letter-spacing: .11em; font-weight: 800; }
.sync, .subtle { color: #9bb0c2; }
main { padding: 24px; max-width: 1800px; margin: auto; }
.metrics { display: grid; grid-template-columns: repeat(7, minmax(145px, 1fr)); gap: 12px; margin-bottom: 16px; }
.metric, .panel { background: linear-gradient(180deg, #122538, #0c1d2c); border: 1px solid #294057; border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.18); }
.metric { padding: 16px; min-height: 112px; }
.metric .label { color: #9fb2c2; font-size: .78rem; min-height: 34px; }
.metric .value { font-size: 2rem; font-weight: 850; line-height: 1; margin-top: 10px; }
.metric.red .value { color: #ff5c5c; }.metric.orange .value { color: #ff932f; }.metric.yellow .value { color: #ffd047; }.metric.green .value { color: #75df58; }.metric.blue .value { color: #51aaff; }.metric.purple .value { color: #a779ff; }
.panel { padding: 16px; margin-bottom: 16px; }
.emphasis { border-color: #926f1d; box-shadow: 0 0 0 1px rgba(255,193,49,.1), 0 12px 30px rgba(0,0,0,.18); }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 12px; }
button { background: #155eb0; color: white; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 750; cursor: pointer; }
.table-wrap { overflow-x: auto; border: 1px solid #263d52; border-radius: 9px; }
table { width: 100%; border-collapse: collapse; min-width: 1200px; }
th, td { padding: 11px 10px; border-bottom: 1px solid #22384a; text-align: left; font-size: .82rem; white-space: nowrap; }
th { position: sticky; top: 0; background: #0b1a27; color: #a8bed0; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
tr:hover td { background: rgba(69, 139, 206, .08); }
.badge { display: inline-block; border-radius: 999px; padding: 4px 8px; font-weight: 800; font-size: .72rem; }
.badge.overdue { background: #8d2424; color: #ffd6d6; }.badge.due-soon { background: #9a5315; color: #ffe5c7; }.badge.due-later { background: #806815; color: #fff0a8; }.badge.compliant { background: #225e2d; color: #d4ffda; }.badge.unknown { background: #46596a; color: #e2edf5; }
.grid-two { display: grid; grid-template-columns: 1.45fr .55fr; gap: 16px; }
.forecast { display: grid; gap: 9px; }
.forecast-row { display: grid; grid-template-columns: 64px 1fr; gap: 12px; align-items: center; }
.bars { display: flex; gap: 5px; align-items: end; height: 44px; }
.bar { min-width: 12px; border-radius: 4px 4px 0 0; background: #4f9ce6; position: relative; }
.bar.pants { background: #9d6ce0; }.bar.other { background: #e7b843; }
.location-summary { display: grid; gap: 10px; }
.location-card { display: flex; justify-content: space-between; padding: 13px; border: 1px solid #2a4258; border-radius: 9px; background: #0b1b29; }
.error { padding: 18px; border: 1px solid #a23e3e; background: #3c1717; border-radius: 10px; }
@media (max-width: 1200px) { .metrics { grid-template-columns: repeat(4, 1fr); }.grid-two { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .topbar { align-items: flex-start; flex-direction: column; }.metrics { grid-template-columns: repeat(2, 1fr); } main { padding: 14px; }.panel-header { align-items: flex-start; flex-direction: column; } }
