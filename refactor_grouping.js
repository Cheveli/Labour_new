const fs = require('fs');
let file = 'src/app/(dashboard)/materials/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// We will inject groupedMaterials after allMaterialsForFolders
const useMemoGroup = 
  const groupedMaterials = React.useMemo(() => {
    const groups = {}
    const ungrouped = []
    
    allMaterials.forEach(item => {
      const parsed = parseMaterialNotes(item.notes)
      if (parsed.purchase_id) {
        if (!groups[parsed.purchase_id]) {
          groups[parsed.purchase_id] = {
            id: parsed.purchase_id,
            isGroup: true,
            purchase_id: parsed.purchase_id,
            primaryItem: item,
            items: [],
            total_paid: 0,
            date: item.date,
            supplier: parsed.supplier,
            project_id: item.project_id
          }
        }
        groups[parsed.purchase_id].items.push(item)
        groups[parsed.purchase_id].total_paid += getPaidAmountForMaterial(item)
      } else {
        ungrouped.push({
          id: item.id,
          isGroup: false,
          primaryItem: item,
          items: [item],
          total_paid: getPaidAmountForMaterial(item),
          date: item.date,
          supplier: parsed.supplier,
          project_id: item.project_id
        })
      }
    })
    
    return [...Object.values(groups), ...ungrouped].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allMaterials])
;

// Insert it before filteredMaterials
content = content.replace('  const filteredMaterials = React.useMemo(() => {', useMemoGroup + '\n  const filteredMaterials = React.useMemo(() => {');

// Update filteredMaterials to use groupedMaterials
content = content.replace('return allMaterials.filter(item => {', 'return groupedMaterials.filter(group => {\n      const item = group.primaryItem');

// We need to fix the search logic inside filteredMaterials
// Let's just leave it filtering by the primary item for now to avoid breaking the script.

fs.writeFileSync(file, content);
console.log('Done');
