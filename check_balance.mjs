import fs from 'fs';
const content = fs.readFileSync('src/pages/DirectMessage.tsx','utf8');
const lines = content.split('\n');
let brace = 0, paren = 0, bracket = 0;
for (let idx = 0; idx < lines.length; idx++) {
  const line = lines[idx];
  for (const ch of line) {
    if (ch === '{') brace++;
    if (ch === '}') brace--;
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (ch === '[') bracket++;
    if (ch === ']') bracket--;
  }
  if (brace < 0) {
    console.log(`Brace negative at line ${idx + 1}: ${line}`);
    brace = 0;
  }
  if (paren < 0) {
    console.log(`Paren negative at line ${idx + 1}: ${line}`);
    paren = 0;
  }
  if (idx === 567) {
    console.log('Up to <main> line counts:', { brace, paren, bracket });
  }
}
console.log('final counts:', { brace, paren, bracket });
