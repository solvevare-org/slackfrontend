import fs from 'fs';
const path = 'D:/ff/lastSolveare/Solveare/slackfrontend/src/pages/Admin.tsx';
const src = fs.readFileSync(path, 'utf8');
console.log('contains wsMembers:', src.includes('wsMembers.length > 0'));
console.log('first occurrence index:', src.indexOf('wsMembers.length > 0'));
