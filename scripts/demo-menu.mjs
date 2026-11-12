// Fictional Malaysian campus specials. Integer prices are MYR sen.
// Added through save_menu_item; existing menu and order snapshots are never edited.
export const demoMenu = [
  { key: "laksa", vendor: "campus-noodle-bar", operator: "vendor-noodles", name: "Hot Curry Laksa", description: "Hot coconut curry soup, noodles and chicken.", price: 1250, stock: 60, units: 2 },
  { key: "soup", vendor: "campus-noodle-bar", operator: "vendor-noodles", name: "Ginger Chicken Soup Noodles", description: "Warming ginger broth and rice noodles.", price: 1100, stock: 60, units: 1 },
  { key: "dry-noodles", vendor: "campus-noodle-bar", operator: "vendor-noodles", name: "Soy Mushroom Dry Noodles", description: "Wok noodles, mushrooms and greens.", price: 950, stock: 60, units: 1 },
  { key: "dumplings", vendor: "campus-noodle-bar", operator: "vendor-noodles", name: "Steamed Vegetable Dumplings", description: "Six vegetable dumplings with ginger dip.", price: 750, stock: 60, units: 1 },
  { key: "kopi", vendor: "brew-and-bites", operator: "vendor-coffee", name: "Hot Kopi O", description: "Freshly brewed hot black coffee.", price: 350, stock: 80, units: 1 },
  { key: "teh", vendor: "brew-and-bites", operator: "vendor-coffee", name: "Hot Teh Tarik", description: "Pulled milk tea served hot.", price: 400, stock: 80, units: 1 },
  { key: "lime", vendor: "brew-and-bites", operator: "vendor-coffee", name: "Iced Lime Tea", description: "Cold lime tea over ice for a warm afternoon.", price: 450, stock: 80, units: 1 },
  { key: "cold-kopi", vendor: "brew-and-bites", operator: "vendor-coffee", name: "Iced White Coffee", description: "Cold milk coffee served over ice.", price: 550, stock: 80, units: 1 },
  { key: "toast", vendor: "brew-and-bites", operator: "vendor-coffee", name: "Kaya Toast Snack", description: "Crisp toast with kaya and butter.", price: 500, stock: 60, units: 1 },
  { key: "fruit", vendor: "brew-and-bites", operator: "vendor-coffee", name: "Chilled Watermelon Cup", description: "Chilled cut fruit snack.", price: 450, stock: 60, units: 1 },
];

export const demoProfiles = {
  light: { requests: 4, intervalMs: 1200 },
  medium: { requests: 12, intervalMs: 700 },
  heavy: { requests: 24, intervalMs: 250 },
};
