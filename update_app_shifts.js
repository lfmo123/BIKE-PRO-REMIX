const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { ShiftControl }")) {
  code = code.replace("import { CustomerCards } from './components/CustomerCards';", "import { CustomerCards } from './components/CustomerCards';\nimport { ShiftControl } from './components/ShiftControl';");
}

if (!code.includes("import { ParkedVehicle, Pricing, LostCard, Transaction, Product, Sale, CustomerCard, Shift }")) {
  code = code.replace("CustomerCard } from './types';", "CustomerCard, Shift } from './types';");
}

if (!code.includes("const [shifts, setShifts]")) {
  code = code.replace("const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);", "const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);\n  const [shifts, setShifts] = useState<Shift[]>([]);\n  const activeShift = shifts.find(s => s.status === 'open');");
}

if (!code.includes("fetchShifts")) {
  const fetchCardCode = `
  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/shifts');
      if (res.ok) setShifts(await res.json());
    } catch (e) { console.error('Failed to fetch shifts', e); }
  };
  `;
  code = code.replace("const fetchLostCards = async () => {", fetchCardCode + "\n  const fetchLostCards = async () => {");
  
  code = code.replace("fetchCustomerCards();", "fetchCustomerCards();\n    fetchShifts();");
}

if (!code.includes("handleOpenShift")) {
  const shiftFunctions = `
  const handleOpenShift = async (operatorName: string, initialChange: number) => {
    try {
      const newShift: Omit<Shift, 'id'> = { operatorName, initialChange, startTime: Date.now(), status: 'open' };
      const res = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newShift, id: Date.now().toString() }) });
      if (res.ok) fetchShifts();
    } catch (error) { console.error(error); }
  };

  const handleCloseShift = async (shift: Shift) => {
    try {
      const res = await fetch(\`/api/shifts/\${shift.id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shift) });
      if (res.ok) fetchShifts();
    } catch (error) { console.error(error); }
  };
  `;
  code = code.replace("const fetchLostCards = async () => {", shiftFunctions + "\n  const fetchLostCards = async () => {");
}

if (!code.includes("activeTab === 'shifts'")) {
  code = code.replace("{activeTab === 'cards'", "{activeTab === 'shifts' && <ShiftControl shifts={shifts} transactions={transactions} vehicles={vehicles} sales={sales} activeShift={activeShift} user={user as any} onOpenShift={handleOpenShift} onCloseShift={handleCloseShift} />}\n                {activeTab === 'cards'");
}

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated for shifts');
