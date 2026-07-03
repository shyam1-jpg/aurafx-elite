const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, '..', 'website', 'public');
const logoNav = '<a href="index.html" class="logo" aria-label="AuraFX Elite home"><img src="assets/aurafx-elite-logo.png?v=6" alt="" class="logo-img" width="160" height="160" decoding="sync" /></a>';
const logoDash = '<a href="index.html" aria-label="AuraFX Elite home"><img src="assets/aurafx-elite-logo.png?v=6" alt="" class="logo-img" width="160" height="160" decoding="sync" /></a>';
const heroBlock = '<div class="hero-logo-wrap"><img src="assets/aurafx-elite-logo.png?v=6" alt="AuraFX Elite logo" class="hero-logo" width="320" /></div>';
const headBrand = '  <link rel="icon" href="assets/aura-icon-140.png?v=6" type="image/png" />\n  <script src="js/site-boot.js?v=6"></script>\n';
let count = 0;
for (const name of fs.readdirSync(publicDir)) {
  if (!name.endsWith('.html') || name.includes(' - Copy')) continue;
  const file = path.join(publicDir, name);
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  c = c.replace(/href="css\/site\.css(\?v=\d+)?"/g, 'href="css/site.css?v=8"');
  c = c.replace(/href="css\/pro-dashboard\.css(\?v=\d+)?"/g, 'href="css/pro-dashboard.css?v=8"');
  c = c.replace(/<link rel="icon" href="assets\/aura-logo\.svg[^"]*" type="image\/svg\+xml" *\/?>/g, '<link rel="icon" href="assets/aura-icon-140.png?v=6" type="image/png" />');
  c = c.replace(/<link rel="icon" href="assets\/aurafx-elite-logo\.png" type="image\/png" *\/?>/g, '<link rel="icon" href="assets/aura-icon-140.png?v=6" type="image/png" />');
  c = c.replace(/src="js\/site-boot\.js(\?v=\d+)?"/g, 'src="js/site-boot.js?v=6"');
  c = c.replace(/<a href="index\.html" class="logo"[^>]*>[\s\S]*?<\/a>/g, logoNav);
  c = c.replace(/<a href="index\.html">AuraFX <span>Pro<\/span><\/a>/g, logoDash);
  c = c.replace(/<img src="assets\/aura-logo-hero\.svg[^"]*"[^>]*\/?>/g, heroBlock);
  c = c.replace(/<img src="assets\/aurafx-elite-logo\.png(\?v=\d+)?" alt="" width="72" height="72" style="[^"]*" *\/?>/g, heroBlock);
  if (!/js\/site-boot\.js/.test(c)) c = c.replace(/<head[^>]*>/, (m) => m + '\n' + headBrand);
  else if (!/<head>[\s\S]{0,5000}js\/site-boot/.test(c)) c = c.replace(/(<link rel="stylesheet" href="css\/site\.css\?v=8" \/>)/, '$1\n' + headBrand);
  if (!/rel="icon"/.test(c)) c = c.replace(/<title>[^<]+<\/title>/, (m) => m + '\n  <link rel="icon" href="assets/aura-icon-140.png?v=6" type="image/png" />');
  c = c.replace(/\n\s*<script src="js\/site-boot\.js\?v=6"><\/script>\s*(?=\n\s*<script)/g, '\n');
  c = c.replace(/(\n\s*)<script src="js\/site-boot\.js\?v=6"><\/script>\s*\n(\s*<\/body>)/g, '$1$2');
  if (c !== orig) { fs.writeFileSync(file, c, 'utf8'); count++; console.log('Updated:', name); }
}
console.log('Done.', count, 'file(s) updated.');
