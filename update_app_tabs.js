const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { CustomerCards }")) {
  code = code.replace("import { CashBook } from './components/CashBook';", "import { CashBook } from './components/CashBook';\nimport { CustomerCards } from './components/CustomerCards';");
}

if (!code.includes("import { CustomerCard }")) {
  code = code.replace("import { VehicleType, Transaction, Product, Sale, LostCard }", "import { VehicleType, Transaction, Product, Sale, LostCard, CustomerCard }");
}

if (!code.includes("customerCards")) {
  code = code.replace("const [lostCards, setLostCards] = useState<LostCard[]>([]);", "const [lostCards, setLostCards] = useState<LostCard[]>([]);\n  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);");
  
  const fetchCardCode = `
  const fetchCustomerCards = async () => {
    try {
      const res = await fetch('/api/customer-cards');
      if (res.ok) setCustomerCards(await res.json());
    } catch (e) { console.error('Failed to fetch customer cards', e); }
  };
  `;
  code = code.replace("const fetchLostCards = async () => {", fetchCardCode + "\n  const fetchLostCards = async () => {");
  
  code = code.replace("fetchLostCards();\n      fetchTransactions();", "fetchLostCards();\n      fetchTransactions();\n      fetchCustomerCards();");
}

if (!code.includes("handleAddCard")) {
  const customMethods = `
  const handleAddCard = async (card: Omit<CustomerCard, 'id'>) => {
    try {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      const res = await fetch('/api/customer-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...card, id }) });
      if (res.ok) fetchCustomerCards();
    } catch (error) { console.error(error); }
  };

  const handleUpdateCard = async (id: string, card: Partial<CustomerCard>) => {
    try {
      const res = await fetch(\`/api/customer-cards/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card) });
      if (res.ok) fetchCustomerCards();
    } catch (error) { console.error(error); }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      const res = await fetch(\`/api/customer-cards/\${id}\`, { method: 'DELETE' });
      if (res.ok) fetchCustomerCards();
    } catch (error) { console.error(error); }
  };
  `;
  code = code.replace("const fetchLostCards = async () => {", customMethods + "\n  const fetchLostCards = async () => {");
}

if (!code.includes("activeTab === 'cards'")) {
  code = code.replace("{activeTab === 'cashbook'", "{activeTab === 'cards' && <CustomerCards cards={customerCards} onAddCard={handleAddCard} onUpdateCard={handleUpdateCard} onDeleteCard={handleDeleteCard} onAddTransaction={handleAddTransaction} />}\n                {activeTab === 'cashbook'");
}

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
