const fs = require('fs');
const filePath = 'd:/Split/New/TripSplit/src/app/(auth)/verify-email.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace('catch (err) {', 'catch (err: any) {');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed type annotation in verify-email.tsx');
