const fs = require('fs');
let file = 'src/app/(dashboard)/materials/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex1 = /                \{parsed\.invoice_number && \([\s\S]*?\}\)\n/;
content = content.replace(regex1, '');

const regex2 = /                <div className="space-y-1">\n                  <label className="text-\[10px\] font-black text-zinc-500 uppercase tracking-wider">Invoice Number<\/label>[\s\S]*?<\/div>\n/;
content = content.replace(regex2, '');

const regex3 = /                  <div className="col-span-2 space-y-1\.5">\n                    <label className="text-\[9px\] font-black uppercase tracking-widest text-zinc-500">Invoice Number<\/label>[\s\S]*?<\/div>\n/;
content = content.replace(regex3, '');

fs.writeFileSync(file, content);
console.log('Done');
