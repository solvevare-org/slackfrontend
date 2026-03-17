import fs from 'fs';
const content = fs.readFileSync('D:/ff/lastSolveare/Solveare/slackfrontend/src/pages/DirectMessage.tsx', 'utf8');
console.log('backticks:', content.split('`').length - 1);
