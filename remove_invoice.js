const fs = require('fs');
let file = 'src/app/(dashboard)/materials/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. State
content = content.replace(/  const \\[commonInvoice, setCommonInvoice\\] = useState\\('.*'\\)\r?\n/g, '');
// 2. notes json
content = content.replace(/          invoice_number: [^\n]*\r?\n/g, '');
content = content.replace(/  invoice_number: string \\| null\r?\n/g, '');
// 3. search
content = content.replace(/        const matchInvoice = [^\n]*\r?\n/g, '');
content = content.replace(/!matchInvoice && /g, '');
// 4. resets
content = content.replace(/      setCommonInvoice\\([^\n]*\\)\r?\n/g, '');
content = content.replace(/                          setCommonInvoice\\('');\r?\n/g, '');

fs.writeFileSync(file, content);
console.log('Done');
