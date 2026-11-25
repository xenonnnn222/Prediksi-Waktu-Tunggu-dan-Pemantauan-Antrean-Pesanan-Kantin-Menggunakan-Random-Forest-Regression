// Pengelompokan & pemetaan ikon ilustrasi Microsoft Fluent Emoji untuk 30 menu U'Jasmine.
// Catatan: murni untuk kenyamanan tampilan & filter UI, bukan fitur model ML.

export const MENU_CATEGORIES = [
  { id: 'semua', label: 'Semua', icon: 'bento-box' },
  { id: 'nasi', label: 'Nasi & Lauk', icon: 'curry-rice' },
  { id: 'mie', label: 'Mie & Tinutuan', icon: 'steaming-bowl' },
  { id: 'cemilan', label: 'Pisang & Gorengan', icon: 'banana' },
  { id: 'minuman', label: 'Minuman & Es', icon: 'shaved-ice' },
];

export function getMenuMeta(nama) {
  const n = String(nama || '').toLowerCase();

  if (n.includes('air mineral')) {
    return { category: 'minuman', icon: 'droplet', tone: 'sky', tag: 'Air Mineral' };
  }
  if (n.includes('gohu')) {
    return { category: 'minuman', icon: 'mango', tone: 'butter', tag: 'Segar Manis' };
  }
  if (n.includes('kolak')) {
    return { category: 'minuman', icon: 'bowl-with-spoon', tone: 'apricot', tag: 'Manis Hangat' };
  }
  if (n.startsWith('es ')) {
    const icon = n.includes('kepal') ? 'chocolate-bar' : n.includes('kacang') ? 'cup-with-straw' : 'shaved-ice';
    return { category: 'minuman', icon, tone: 'mint', tag: 'Es Segar' };
  }
  if (n.includes('tinutuan')) {
    return { category: 'mie', icon: 'pot-of-food', tone: 'butter', tag: 'Khas Manado' };
  }
  if (n.includes('mie') || n.includes('indomie')) {
    const icon = n.includes('goreng') ? 'shallow-pan-of-food' : 'steaming-bowl';
    return { category: 'mie', icon, tone: 'apricot', tag: n.includes('double') ? 'Porsi Double' : 'Hangat' };
  }
  if (n.includes('pisang')) {
    const icon = n.includes('coklat') ? 'chocolate-bar' : 'banana';
    return { category: 'cemilan', icon, tone: 'butter', tag: 'Olahan Pisang' };
  }
  if (n.includes('tahu') || n.includes('tempe goreng')) {
    return { category: 'cemilan', icon: 'dumpling', tone: 'apricot', tag: 'Gorengan' };
  }
  if (n.includes('nasi goreng')) {
    const icon = n.includes('cakalang') || n.includes('roa') ? 'shallow-pan-of-food' : 'cooking';
    return { category: 'nasi', icon, tone: 'tangerine', tag: 'Nasi Goreng' };
  }
  if (n.includes('ikan')) {
    return { category: 'nasi', icon: 'fish', tone: 'sky', tag: 'Lauk Ikan' };
  }
  if (n.includes('geprek') || n.includes('ayam')) {
    return { category: 'nasi', icon: 'poultry-leg', tone: 'tangerine', tag: 'Lauk Ayam' };
  }
  if (n.includes('tempe penyet')) {
    return { category: 'nasi', icon: 'curry-rice', tone: 'butter', tag: 'Penyetan' };
  }
  return { category: 'nasi', icon: 'bento-box', tone: 'apricot', tag: 'Menu Kantin' };
}
