import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import confetti from 'canvas-confetti';
import {
  House, ChartPieSlice, Receipt, CreditCard, Trophy, SignOut, Plus, PencilSimple, Trash, Check,
} from '@phosphor-icons/react';
import {
  fmt, fmtShort, toMonthly, expenseMonthly, expenseAnnual,
  getNextDueDate, fmtDate, daysUntil, payPeriodEnd, progressColor,
  CATEGORIES, getCategoryEmoji, BUCKET_COLOURS,
} from '../lib/finance';

const TABS = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'budget', label: 'Budget', Icon: ChartPieSlice },
  { key: 'expenses', label: 'Expenses', Icon: Receipt },
  { key: 'debts', label: 'Debts', Icon: CreditCard },
  { key: 'paid', label: 'Paid', Icon: Trophy },
];

export default function MyFinance() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('home');
  const [expenses, setExpenses] = useState([]);
  const [debts, setDebts] = useState([]);
  const [paidDebts, setPaidDebts] = useState([]);
  const [budget, setBudget] = useState({ salary: 0, freq: 'monthly', payDate: null });
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);

  const reloadAll = useCallback(async () => {
    try {
      const [e, d, p, b, bk] = await Promise.all([
        api.get('/expenses'), api.get('/debts'), api.get('/debts/paid'),
        api.get('/budget'), api.get('/buckets'),
      ]);
      setExpenses(e.data); setDebts(d.data); setPaidDebts(p.data);
      setBudget(b.data); setBuckets(bk.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Derived metrics
  const monthlyIncome = toMonthly(budget.salary || 0, budget.freq || 'monthly');
  const monthlyExp = expenses.reduce((s, e) => s + expenseMonthly(e), 0);
  const surplus = monthlyIncome - monthlyExp;
  const totalDebt = debts.reduce((s, d) => s + d.remaining, 0);
  const monthlyDebtOut = debts.reduce((s, d) => s + (d.monthly || 0), 0);
  const nextPay = getNextDueDate(budget.payDate, budget.freq || 'monthly');
  const periodEnd = payPeriodEnd(budget.freq || 'monthly');
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = expenses
    .map(e => ({ e, next: getNextDueDate(e.dueDate, e.freq) }))
    .filter(({ next }) => next && next >= today && next <= periodEnd)
    .sort((a,b) => a.next - b.next);

  // ---- modal state ----
  const [modal, setModal] = useState(null); // { type, ... }
  const closeModal = () => setModal(null);

  // ---- handlers ----
  const saveExpense = async (payload, id) => {
    if (id) { const { data } = await api.put(`/expenses/${id}`, payload); setExpenses(s => s.map(x => x.id === id ? data : x)); }
    else { const { data } = await api.post('/expenses', payload); setExpenses(s => [...s, data]); }
    closeModal();
  };
  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`); setExpenses(s => s.filter(x => x.id !== id));
  };
  const addDebt = async (payload) => {
    const { data } = await api.post('/debts', payload); setDebts(s => [...s, data]); closeModal();
  };
  const deleteDebt = async (id) => {
    if (!window.confirm('Delete this debt?')) return;
    await api.delete(`/debts/${id}`); setDebts(s => s.filter(x => x.id !== id));
  };
  const logPayment = async (debtId, payload) => {
    const { data } = await api.post(`/debts/${debtId}/payments`, payload);
    closeModal();
    if (data.fully_paid) {
      // celebrate
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.4 }, colors: ['#D1603D','#E8A365','#4A6B5D','#C44D42','#1C1B1A'] });
      setTimeout(() => setTab('paid'), 700);
    }
    await reloadAll();
  };
  const saveBudget = async (payload) => {
    const { data } = await api.put('/budget', payload); setBudget(data);
  };
  const saveBucket = async (payload, id) => {
    if (id) { const { data } = await api.put(`/buckets/${id}`, payload); setBuckets(s => s.map(x => x.id === id ? data : x)); }
    else { const { data } = await api.post('/buckets', payload); setBuckets(s => [...s, data]); }
    closeModal();
  };
  const deleteBucket = async (id) => {
    if (!window.confirm('Delete this bucket?')) return;
    await api.delete(`/buckets/${id}`); setBuckets(s => s.filter(x => x.id !== id));
  };

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-muted">Loading…</div>;

  return (
    <div className="min-h-screen bg-paper" data-testid="myfinance-app">
      <Header user={user} onLogout={logout} tab={tab}
        monthlyIncome={monthlyIncome} monthlyExp={monthlyExp} totalDebt={totalDebt} surplus={surplus} paidTotal={paidDebts.reduce((s,d)=>s+d.original,0)} />

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pb-32 pt-2">
        {tab === 'home' && (
          <HomeTab budget={budget} monthlyIncome={monthlyIncome} monthlyExp={monthlyExp}
            surplus={surplus} totalDebt={totalDebt} nextPay={nextPay} upcoming={upcoming}
            buckets={buckets} debts={debts} />
        )}
        {tab === 'budget' && (
          <BudgetTab budget={budget} onSaveBudget={saveBudget}
            expenses={expenses} monthlyIncome={monthlyIncome} monthlyExp={monthlyExp}
            buckets={buckets}
            onAddBucket={() => setModal({ type: 'bucket' })}
            onEditBucket={(b) => setModal({ type: 'bucket', bucket: b })}
            onDeleteBucket={deleteBucket} />
        )}
        {tab === 'expenses' && (
          <ExpensesTab expenses={expenses} budget={budget} upcoming={upcoming}
            onAdd={() => setModal({ type: 'expense' })}
            onEdit={(e) => setModal({ type: 'expense', expense: e })}
            onDelete={deleteExpense} />
        )}
        {tab === 'debts' && (
          <DebtsTab debts={debts} totalDebt={totalDebt} monthlyOut={monthlyDebtOut}
            onAdd={() => setModal({ type: 'debt' })}
            onPayment={(d) => setModal({ type: 'payment', debt: d })}
            onDelete={deleteDebt} />
        )}
        {tab === 'paid' && <PaidTab paidDebts={paidDebts} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type === 'expense' && <ExpenseModal expense={modal.expense} onClose={closeModal} onSave={saveExpense} />}
      {modal?.type === 'debt' && <DebtModal onClose={closeModal} onSave={addDebt} />}
      {modal?.type === 'payment' && <PaymentModal debt={modal.debt} onClose={closeModal} onSave={logPayment} />}
      {modal?.type === 'bucket' && <BucketModal bucket={modal.bucket} onClose={closeModal} onSave={saveBucket} />}
    </div>
  );
}

// ============== HEADER ==============
function Header({ user, onLogout, tab, monthlyIncome, monthlyExp, totalDebt, surplus, paidTotal }) {
  const initials = (user?.name || user?.email || '?').slice(0,2).toUpperCase();
  let amount = 0, sub = '';
  if (tab === 'home') { amount = Math.max(0, surplus); sub = monthlyIncome > 0 ? 'monthly surplus' : 'set salary in Budget'; }
  else if (tab === 'expenses') { amount = monthlyExp; sub = 'monthly expenses'; }
  else if (tab === 'debts') { amount = totalDebt; sub = 'total outstanding debt'; }
  else if (tab === 'paid') { amount = paidTotal; sub = 'total debt cleared'; }
  else if (tab === 'budget') { amount = Math.max(0, surplus); sub = surplus >= 0 ? 'left after expenses' : 'over budget'; }
  return (
    <header className="bg-bone border-b border-line">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-10 pb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted mb-1">My finances</div>
            <div className="font-display text-4xl sm:text-5xl font-black tracking-tighter leading-none tabular" data-testid="header-amount">{fmt(amount)}</div>
            <div className="text-xs text-muted mt-1.5" data-testid="header-sub">{sub}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-terracotta text-white flex items-center justify-center font-bold text-sm" data-testid="user-avatar">{initials}</div>
            <button onClick={onLogout} data-testid="logout-button" title="Sign out"
              className="w-10 h-10 rounded-full border border-line text-muted hover:text-ink hover:border-ink flex items-center justify-center transition-colors">
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============== BOTTOM NAV ==============
function BottomNav({ tab, setTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-line z-40" data-testid="bottom-nav">
      <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} data-testid={`nav-${key}`}
              className="flex flex-col items-center gap-0.5 py-1.5 relative">
              <Icon size={22} weight={active ? 'fill' : 'regular'} color={active ? '#D1603D' : '#7A7873'} />
              <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-terracotta' : 'text-muted'}`}>{label}</span>
              {active && <span className="absolute -top-0.5 w-1 h-1 rounded-full bg-terracotta" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ============== HOME TAB ==============
function HomeTab({ budget, monthlyIncome, monthlyExp, surplus, totalDebt, nextPay, upcoming, buckets, debts }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dpay = daysUntil(nextPay);
  const totalBucketPct = buckets.reduce((s,b)=>s+b.pct,0) || 100;
  return (
    <div className="space-y-4 pt-2">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">{greet}.</h2>
        <p className="text-xs text-muted mt-0.5">{new Date().toLocaleDateString('en-AU',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
      </div>

      <div className="bg-ink text-white rounded-lg p-6 relative overflow-hidden" data-testid="home-surplus-card">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-terracotta/30 blur-2xl" />
        <div className="relative">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 mb-2">Monthly surplus</div>
          <div className="font-display text-5xl font-black tracking-tighter leading-none tabular" style={{color: surplus >= 0 ? '#E8A365' : '#FF8B7B'}}>{fmt(surplus)}</div>
          <div className="text-xs text-white/60 mt-2">{surplus < 0 ? 'over budget this month' : 'after all expenses'}</div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <Mini label="Income" value={monthlyIncome > 0 ? fmt(monthlyIncome) : '—'} />
            <Mini label="Expenses" value={fmt(monthlyExp)} />
            <Mini label="Total debt" value={fmtShort(totalDebt)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Label>Next pay</Label>
          <div className="font-display text-2xl font-bold tabular text-terracotta mt-1" data-testid="home-next-pay">
            {dpay === null ? 'Not set' : dpay === 0 ? 'Today' : dpay === 1 ? 'Tomorrow' : `${dpay} days`}
          </div>
          <div className="text-[11px] text-muted mt-1">{nextPay ? fmtDate(nextPay) : 'Set in Budget'}</div>
        </Card>
        <Card>
          <Label>Due this period</Label>
          <div className="font-display text-2xl font-bold tabular mt-1">{upcoming.length}</div>
          <div className="text-[11px] text-muted mt-1">{upcoming.length>0 ? `${fmt(upcoming.reduce((s,{e})=>s+e.amount,0))} total` : 'No dues set'}</div>
        </Card>
      </div>

      {buckets.length > 0 && (
        <Card>
          <Label>Pay period allocation</Label>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mt-3 mb-3">
            {buckets.map(b => <div key={b.id} style={{ flex: b.pct, background: b.colour }} />)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {buckets.slice(0,4).map(b => (
              <div key={b.id} className="flex items-center justify-between bg-surface-alt rounded-md px-2.5 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: b.colour }} />
                  <span className="text-[11px] text-ink truncate">{b.name}</span>
                </div>
                <span className="text-[11px] tabular font-semibold" style={{ color: b.colour }}>{budget.salary > 0 ? fmt(budget.salary * b.pct/totalBucketPct) : `${b.pct}%`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <Label className="mb-2 block">Upcoming payments</Label>
        {upcoming.length === 0 ? (
          <Card><div className="text-center text-muted text-sm py-3">Nothing due this period 🎉</div></Card>
        ) : (
          <div className="space-y-2" data-testid="upcoming-list">
            {upcoming.slice(0,4).map(({e,next}) => {
              const days = daysUntil(next); const urgent = days <= 2;
              return (
                <div key={e.id} className={`bg-white border rounded-lg px-3.5 py-3 flex items-center justify-between ${urgent ? 'border-warning/40' : 'border-line'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-md flex flex-col items-center justify-center flex-shrink-0 ${urgent ? 'bg-warning/15 text-warning' : 'bg-surface-alt text-muted'}`}>
                      <span className="font-mono text-[10px] font-bold leading-none">{days===0?'NOW':days===1?'TMW':`${days}D`}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{e.name}</div>
                      <div className="text-[11px] text-muted">{fmtDate(next)}</div>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold tabular">{fmt(e.amount)}</div>
                </div>
              );
            })}
            {upcoming.length > 4 && <div className="text-center text-[10px] text-muted">+{upcoming.length - 4} more</div>}
          </div>
        )}
      </div>

      <div>
        <Label className="mb-2 block">Debt progress</Label>
        {debts.length === 0 ? (
          <Card><div className="text-center text-muted text-sm py-3">No outstanding debts 🏆</div></Card>
        ) : (
          <div className="space-y-2">
            {debts.slice(0,3).map(d => {
              const pct = Math.round((1 - d.remaining/d.original)*100);
              return (
                <div key={d.id} className="bg-white border border-line rounded-lg p-3.5">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-semibold">{d.name}</div>
                    <div className="text-right">
                      <div className="font-mono text-xs tabular">{fmt(d.remaining)}</div>
                      <div className="text-[10px] text-muted">{pct}% paid</div>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-surface-alt rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: progressColor(pct) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-white/5 rounded-md px-2.5 py-2">
      <div className="text-[9px] text-white/50 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-xs tabular mt-0.5">{value}</div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-line rounded-lg p-4 ${className}`}>{children}</div>;
}
function Label({ children, className = '' }) {
  return <div className={`text-[10px] font-bold uppercase tracking-[0.22em] text-muted ${className}`}>{children}</div>;
}

// ============== BUDGET TAB ==============
function BudgetTab({ budget, onSaveBudget, expenses, monthlyIncome, monthlyExp, buckets, onAddBucket, onEditBucket, onDeleteBucket }) {
  const [salary, setSalary] = useState(budget.salary || '');
  const [freq, setFreq] = useState(budget.freq || 'monthly');
  const [payDate, setPayDate] = useState(budget.payDate || '');
  // commit on blur/change
  const commit = (next) => onSaveBudget({ salary: parseFloat(next.salary)||0, freq: next.freq, payDate: next.payDate || null });

  const remaining = monthlyIncome - monthlyExp;
  const pct = monthlyIncome > 0 ? Math.max(0, Math.min(100, (remaining/monthlyIncome)*100)) : 0;
  const totalPct = buckets.reduce((s,b)=>s+b.pct, 0);
  const nextPay = getNextDueDate(payDate, freq);
  const dpay = daysUntil(nextPay);

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <Label className="mb-3 block">Income setup</Label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-muted mb-1 block">Salary ($)</label>
            <input data-testid="budget-salary-input" type="number" inputMode="decimal" value={salary}
              onChange={e=>setSalary(e.target.value)} onBlur={()=>commit({salary, freq, payDate})}
              placeholder="0.00"
              className="w-full bg-surface-alt border border-line rounded-md px-3 py-2.5 outline-none focus:border-terracotta" />
          </div>
          <div>
            <label className="text-[10px] text-muted mb-1 block">Frequency</label>
            <select data-testid="budget-freq-select" value={freq}
              onChange={e=>{setFreq(e.target.value); commit({salary, freq: e.target.value, payDate});}}
              className="w-full bg-surface-alt border border-line rounded-md px-3 py-2.5 outline-none focus:border-terracotta">
              <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option><option value="annual">Annual</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="text-[10px] text-muted mb-1 block">Next pay date</label>
            <input data-testid="budget-paydate-input" type="date" value={payDate}
              onChange={e=>{setPayDate(e.target.value); commit({salary, freq, payDate: e.target.value});}}
              className="w-full bg-surface-alt border border-line rounded-md px-3 py-2.5 outline-none focus:border-terracotta" />
          </div>
          <div className="bg-surface-alt rounded-md px-3 py-2.5">
            <div className="text-[10px] text-muted uppercase tracking-wider">Days until pay</div>
            <div className="font-display font-bold text-lg text-terracotta tabular mt-0.5" data-testid="days-until-pay">
              {dpay === null ? '—' : dpay === 0 ? 'Today' : dpay === 1 ? 'Tomorrow' : `${dpay} days`}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-terracotta border-terracotta">
          <Label className="text-white/70 !text-white/70">Monthly income</Label>
          <div className="font-display text-xl font-bold text-white tabular mt-1" data-testid="bud-income">{fmt(monthlyIncome)}</div>
        </Card>
        <Card>
          <Label>Monthly expenses</Label>
          <div className="font-display text-xl font-bold tabular mt-1" data-testid="bud-expenses">{fmt(monthlyExp)}</div>
          <div className="text-[10px] text-muted mt-0.5">all averaged</div>
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-end mb-2">
          <div>
            <Label>Remaining after expenses</Label>
            <div className="font-display text-3xl font-black tabular tracking-tighter" data-testid="bud-remaining"
              style={{ color: remaining >= 0 ? '#4A6B5D' : '#C44D42' }}>{fmt(remaining)}</div>
          </div>
          <div className="text-right text-xs text-muted">{monthlyIncome>0 ? `${Math.round(pct)}% remaining` : '—'}</div>
        </div>
        <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pct > 30 ? '#4A6B5D' : pct > 10 ? '#E8A365' : '#C44D42' }} />
        </div>
        {remaining < 0 && <div className="mt-2 text-[11px] text-clay bg-clay/10 rounded-md px-3 py-2">⚠️ Expenses exceed income</div>}
      </Card>

      <div>
        <Label className="mb-2 block">Expense breakdown</Label>
        <div className="space-y-2">
          {[...expenses].sort((a,b)=>expenseMonthly(b)-expenseMonthly(a)).map(e => {
            const m = expenseMonthly(e);
            const epct = monthlyIncome > 0 ? (m/monthlyIncome*100) : 0;
            return (
              <div key={e.id} className="bg-white border border-line rounded-lg p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{e.name}</div>
                    <div className="text-[10px] text-muted">{e.provider} · {e.freq}</div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="font-mono text-sm tabular">{fmt(m)}<span className="text-[9px] text-muted">/mo</span></div>
                    <div className="text-[10px] text-muted">{monthlyIncome>0 ? `${epct.toFixed(1)}%` : '—'}</div>
                  </div>
                </div>
                <div className="h-0.5 w-full bg-surface-alt rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-moss" style={{ width: `${Math.min(100, epct)}%` }} />
                </div>
              </div>
            );
          })}
          {expenses.length === 0 && <Card><div className="text-center text-muted text-sm py-2">No expenses yet</div></Card>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Bucket system</Label>
          <button data-testid="add-bucket-btn" onClick={onAddBucket}
            className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center hover:bg-terracotta transition-colors">
            <Plus size={14} weight="bold" />
          </button>
        </div>
        {Math.round(totalPct) !== 100 && buckets.length > 0 && (
          <div className="text-[11px] text-warning bg-warning/10 rounded-md px-3 py-2 mb-2">
            ⚠️ Buckets total {totalPct.toFixed(1)}% — {totalPct < 100 ? `${(100-totalPct).toFixed(1)}% unallocated` : `${(totalPct-100).toFixed(1)}% over 100%`}
          </div>
        )}
        <div className="space-y-2">
          {buckets.map(b => {
            const amt = (parseFloat(salary)||0) * (b.pct/100);
            const periodLabel = freq==='weekly'?'per week':freq==='fortnightly'?'per fortnight':freq==='annual'?'per year':'per month';
            return (
              <div key={b.id} className="bg-white border border-line rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: b.colour }} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{b.name}</div>
                      <div className="text-[10px] text-muted">{b.pct}% of salary</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-mono text-sm tabular font-semibold" style={{ color: b.colour }}>{salary > 0 ? fmt(amt) : '—'}</div>
                      <div className="text-[10px] text-muted">{periodLabel}</div>
                    </div>
                    <button data-testid={`edit-bucket-${b.id}`} onClick={()=>onEditBucket(b)} className="w-7 h-7 rounded-md hover:bg-surface-alt flex items-center justify-center text-muted hover:text-ink transition-colors"><PencilSimple size={14}/></button>
                    <button data-testid={`delete-bucket-${b.id}`} onClick={()=>onDeleteBucket(b.id)} className="w-7 h-7 rounded-md hover:bg-clay/10 flex items-center justify-center text-muted hover:text-clay transition-colors"><Trash size={14}/></button>
                  </div>
                </div>
                <div className="h-1 w-full bg-surface-alt rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.colour }} />
                </div>
              </div>
            );
          })}
        </div>
        {buckets.length > 0 && (
          <div className="mt-3 bg-white border border-line rounded-lg p-3">
            <Label className="mb-2 block">Split overview</Label>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
              {buckets.map(b => <div key={b.id} style={{ flex: b.pct, background: b.colour }} />)}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {buckets.map(b => <span key={b.id} className="text-[10px] font-semibold" style={{ color: b.colour }}>● {b.name} {b.pct}%</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== EXPENSES TAB ==============
function ExpensesTab({ expenses, budget, upcoming, onAdd, onEdit, onDelete }) {
  const [filter, setFilter] = useState('All');
  const monthly = expenses.reduce((s,e)=>s+expenseMonthly(e), 0);
  const annual = expenses.reduce((s,e)=>s+expenseAnnual(e), 0);
  const cats = ['All', ...Array.from(new Set(expenses.map(e=>e.category).filter(Boolean)))];
  const filtered = filter === 'All' ? expenses : expenses.filter(e => e.category === filter);
  const freq = budget.freq || 'monthly';
  const freqLabel = { weekly:'week', fortnightly:'fortnight', monthly:'month', annual:'year' }[freq];

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-terracotta border-terracotta">
          <Label className="!text-white/70">Monthly</Label>
          <div className="font-display text-xl font-bold text-white tabular mt-1" data-testid="exp-monthly">{fmt(monthly)}</div>
        </Card>
        <Card>
          <Label>Annual est.</Label>
          <div className="font-display text-xl font-bold tabular mt-1" data-testid="exp-annual">{fmtShort(annual)}</div>
          <div className="text-[10px] text-muted mt-0.5">incl. quarterly</div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Label>{filter === 'All' ? 'All expenses' : `${getCategoryEmoji(filter)} ${filter}`}</Label>
        <button data-testid="add-expense-btn" onClick={onAdd}
          className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center hover:bg-terracotta transition-colors">
          <Plus size={14} weight="bold" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {cats.map(c => {
          const active = filter === c;
          return (
            <button key={c} onClick={()=>setFilter(c)} data-testid={`cat-chip-${c}`}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors ${active ? 'bg-ink text-white border-ink' : 'bg-white text-muted border-line hover:border-ink hover:text-ink'}`}>
              {c === 'All' ? 'All' : `${getCategoryEmoji(c)} ${c}`}
            </button>
          );
        })}
      </div>

      <div className="space-y-2" data-testid="expense-list">
        {filtered.map(e => {
          const next = getNextDueDate(e.dueDate, e.freq);
          const days = daysUntil(next);
          let dueLabel = '', dueColor = '#7A7873';
          if (next) {
            if (days === 0) { dueLabel = 'Due today'; dueColor = '#C44D42'; }
            else if (days === 1) { dueLabel = 'Due tomorrow'; dueColor = '#E8A365'; }
            else if (days <= 7) { dueLabel = `Due in ${days}d`; dueColor = '#E8A365'; }
            else { dueLabel = fmtDate(next); }
          }
          return (
            <div key={e.id} className="bg-white border border-line rounded-lg px-3.5 py-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold truncate">{e.name}</div>
                  {e.category && <span className="text-[9px] bg-surface-alt rounded px-1.5 py-0.5 text-muted">{getCategoryEmoji(e.category)} {e.category}</span>}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {e.provider}{dueLabel && <> · <span style={{color: dueColor}}>{dueLabel}</span></>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold tabular">{fmt(e.amount)}</div>
                <div className="text-[10px]" style={{ color: e.freq==='monthly'?'#4A6B5D':e.freq==='quarterly'?'#E8A365':'#7A7873' }}>{e.freq}</div>
              </div>
              <button data-testid={`edit-expense-${e.id}`} onClick={()=>onEdit(e)} className="w-8 h-8 rounded-md hover:bg-surface-alt flex items-center justify-center text-muted hover:text-ink"><PencilSimple size={14}/></button>
              <button data-testid={`delete-expense-${e.id}`} onClick={()=>onDelete(e.id)} className="w-8 h-8 rounded-md hover:bg-clay/10 flex items-center justify-center text-muted hover:text-clay"><Trash size={14}/></button>
            </div>
          );
        })}
        {filtered.length === 0 && <Card><div className="text-center text-muted text-sm py-3">No expenses</div></Card>}
      </div>

      <div>
        <Label className="mb-2 block">Upcoming this {freqLabel}</Label>
        {upcoming.length === 0 ? (
          <Card><div className="text-center text-muted text-sm py-3">{expenses.some(e=>e.dueDate)?'Nothing due this period 🎉':'Add due dates to expenses to see upcoming'}</div></Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map(({e,next}) => {
              const days = daysUntil(next); const urgent = days <= 3;
              return (
                <div key={e.id} className={`bg-white border rounded-lg px-3.5 py-3 flex justify-between items-center ${urgent ? 'border-warning/40' : 'border-line'}`}>
                  <div>
                    <div className="text-sm font-semibold">{e.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: urgent ? '#E8A365' : '#7A7873' }}>{fmtDate(next)} · {days===0?'today':days===1?'tomorrow':`in ${days} days`}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tabular">{fmt(e.amount)}</div>
                    <div className="text-[10px] text-muted">{e.freq}</div>
                  </div>
                </div>
              );
            })}
            <div className="bg-surface-alt rounded-lg px-3.5 py-2.5 flex justify-between items-center">
              <div className="text-[11px] font-semibold text-muted">Total due this {freqLabel}</div>
              <div className="font-mono text-sm font-bold tabular text-terracotta">{fmt(upcoming.reduce((s,{e})=>s+e.amount, 0))}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== DEBTS TAB ==============
function DebtsTab({ debts, totalDebt, monthlyOut, onAdd, onPayment, onDelete }) {
  const months = monthlyOut > 0 ? Math.ceil(totalDebt / monthlyOut) : 0;
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-ink border-ink">
          <Label className="!text-white/60">Total debt</Label>
          <div className="font-display text-xl font-bold text-white tabular mt-1" data-testid="debt-total">{fmtShort(totalDebt)}</div>
        </Card>
        <Card>
          <Label>Monthly out</Label>
          <div className="font-display text-xl font-bold tabular mt-1" data-testid="debt-monthly">{fmt(monthlyOut)}</div>
          <div className="text-[10px] text-muted mt-0.5">{months > 0 ? `~${(months/12).toFixed(1)} yrs to clear` : 'no repayments set'}</div>
        </Card>
      </div>
      <div className="flex items-center justify-between">
        <Label>Outstanding debts</Label>
        <button data-testid="add-debt-btn" onClick={onAdd}
          className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center hover:bg-terracotta transition-colors">
          <Plus size={14} weight="bold" />
        </button>
      </div>
      <div className="space-y-2" data-testid="debt-list">
        {debts.map(d => {
          const pct = Math.round((1 - d.remaining/d.original) * 100);
          const recent = (d.payments || []).slice(-2);
          return (
            <div key={d.id} className="bg-white border border-line rounded-lg p-3.5">
              <div className="flex justify-between items-start mb-2.5">
                <div>
                  <div className="text-sm font-bold">{d.name}</div>
                  <div className="text-[11px] text-muted mt-0.5">{d.monthly>0 ? `${fmt(d.monthly)}/mo` : 'No repayment set'}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-semibold tabular">{fmt(d.remaining)}</div>
                  <div className="text-[10px] text-muted">{pct}% paid</div>
                </div>
              </div>
              <div className="h-1 w-full bg-surface-alt rounded-full overflow-hidden mb-2.5">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: progressColor(pct) }} />
              </div>
              <div className="flex justify-between items-center">
                <div className="flex flex-wrap gap-1">
                  {recent.map((p,i) => (
                    <span key={i} className="text-[10px] bg-surface-alt rounded px-1.5 py-0.5 font-mono text-muted">{p.date} · {fmt(p.amount)}</span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button data-testid={`pay-debt-${d.id}`} onClick={()=>onPayment(d)} className="text-[11px] bg-terracotta/10 text-terracotta rounded px-2.5 py-1 font-semibold hover:bg-terracotta hover:text-white transition-colors">+ Payment</button>
                  <button data-testid={`delete-debt-${d.id}`} onClick={()=>onDelete(d.id)} className="w-7 h-7 rounded hover:bg-clay/10 flex items-center justify-center text-muted hover:text-clay"><Trash size={13}/></button>
                </div>
              </div>
            </div>
          );
        })}
        {debts.length === 0 && <Card><div className="text-center text-muted text-sm py-3">No outstanding debts 🏆</div></Card>}
      </div>
    </div>
  );
}

// ============== PAID TAB ==============
function PaidTab({ paidDebts }) {
  const total = paidDebts.reduce((s,d)=>s+d.original, 0);
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-moss border-moss">
          <Label className="!text-white/70">Total cleared</Label>
          <div className="font-display text-xl font-bold text-white tabular mt-1" data-testid="paid-total">{fmt(total)}</div>
        </Card>
        <Card>
          <Label>Debts paid off</Label>
          <div className="font-display text-xl font-bold tabular mt-1" data-testid="paid-count">{paidDebts.length}</div>
          <div className="text-[10px] text-muted mt-0.5">well done!</div>
        </Card>
      </div>
      <Label>Paid in full</Label>
      {paidDebts.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <Trophy size={48} weight="duotone" color="#7A7873" className="mx-auto mb-3 opacity-50"/>
          <div className="text-sm font-semibold">No paid debts yet</div>
          <div className="text-[11px] mt-1">Keep going — you'll get there!</div>
        </div>
      ) : (
        <div className="space-y-2" data-testid="paid-list">
          {paidDebts.map(d => (
            <div key={d.id} className="bg-white border border-moss/30 rounded-lg p-3.5 flex justify-between items-center">
              <div>
                <div className="text-sm font-bold">{d.name}</div>
                <span className="inline-flex items-center gap-1 mt-1 bg-moss/15 text-moss text-[10px] rounded px-1.5 py-0.5 font-semibold"><Check size={10} weight="bold"/> Paid in full</span>
                {d.paidDate && <div className="text-[10px] text-muted mt-1">{d.paidDate}</div>}
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-semibold tabular text-moss">{fmt(d.original)}</div>
                <div className="text-[10px] text-muted">cleared</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== MODAL SHELL ==============
function Modal({ title, onClose, children, testid }) {
  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-end justify-center animate-fade-in" onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }} data-testid={testid}>
      <div className="bg-white w-full max-w-2xl rounded-t-2xl p-5 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <h3 className="font-display text-xl font-bold tracking-tight mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function FormInput({ label, ...props }) {
  return (
    <div className="mb-3">
      <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-1.5 block">{label}</label>
      <input {...props} className="w-full bg-surface-alt border border-line rounded-md px-3 py-2.5 outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta" />
    </div>
  );
}
function FormSelect({ label, children, ...props }) {
  return (
    <div className="mb-3">
      <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-1.5 block">{label}</label>
      <select {...props} className="w-full bg-surface-alt border border-line rounded-md px-3 py-2.5 outline-none focus:border-terracotta">{children}</select>
    </div>
  );
}
function ModalActions({ onCancel, onSave, saveLabel = 'Save', saveTestId }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onCancel} data-testid="modal-cancel" className="flex-1 py-3 rounded-md bg-surface-alt text-muted font-semibold hover:bg-line">Cancel</button>
      <button onClick={onSave} data-testid={saveTestId || 'modal-save'} className="flex-[2] py-3 rounded-md bg-ink text-white font-semibold hover:bg-terracotta transition-colors">{saveLabel}</button>
    </div>
  );
}

// ============== Expense Modal ==============
function ExpenseModal({ expense, onClose, onSave }) {
  const [name, setName] = useState(expense?.name || '');
  const [provider, setProvider] = useState(expense?.provider || '');
  const [amount, setAmount] = useState(expense?.amount || '');
  const [freq, setFreq] = useState(expense?.freq || 'monthly');
  const [dueDate, setDueDate] = useState(expense?.dueDate || '');
  const [category, setCategory] = useState(expense?.category && CATEGORIES.find(c=>c.v===expense.category) ? expense.category : (expense?.category ? 'Custom' : ''));
  const [customCat, setCustomCat] = useState(expense?.category && !CATEGORIES.find(c=>c.v===expense.category) ? expense.category : '');

  const submit = () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) return;
    const cat = category === 'Custom' ? (customCat.trim() || null) : (category || null);
    onSave({ name: name.trim(), provider: provider.trim(), amount: parseFloat(amount), freq, dueDate: dueDate || null, category: cat }, expense?.id);
  };

  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose} testid="expense-modal">
      <FormInput label="Name" data-testid="exp-name-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Netflix" />
      <FormInput label="Provider" data-testid="exp-provider-input" value={provider} onChange={e=>setProvider(e.target.value)} placeholder="e.g. Netflix Inc." />
      <FormSelect label="Category" data-testid="exp-category-select" value={category} onChange={e=>setCategory(e.target.value)}>
        <option value="">— Select category —</option>
        {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.e} {c.v}</option>)}
        <option value="Custom">✏️ Custom category…</option>
      </FormSelect>
      {category === 'Custom' && <FormInput label="Custom category name" data-testid="exp-custom-cat-input" value={customCat} onChange={e=>setCustomCat(e.target.value)} placeholder="e.g. Pet Insurance"/>}
      <FormInput label="Amount ($)" data-testid="exp-amount-input" type="number" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
      <FormSelect label="Frequency" data-testid="exp-freq-select" value={freq} onChange={e=>setFreq(e.target.value)}>
        <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
      </FormSelect>
      <FormInput label="Next due date" data-testid="exp-due-input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
      <ModalActions onCancel={onClose} onSave={submit} saveLabel={expense ? 'Save changes' : 'Add expense'} saveTestId="exp-save-btn" />
    </Modal>
  );
}

// ============== Debt Modal ==============
function DebtModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState('');
  const submit = () => {
    if (!name.trim() || !amount || parseFloat(amount)<=0) return;
    onSave({ name: name.trim(), original: parseFloat(amount), remaining: parseFloat(amount), monthly: parseFloat(monthly)||0 });
  };
  return (
    <Modal title="Add debt" onClose={onClose} testid="debt-modal">
      <FormInput label="Creditor name" data-testid="debt-name-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Westpac"/>
      <FormInput label="Total amount ($)" data-testid="debt-amount-input" type="number" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
      <FormInput label="Monthly repayment ($)" data-testid="debt-monthly-input" type="number" step="0.01" inputMode="decimal" value={monthly} onChange={e=>setMonthly(e.target.value)} placeholder="0.00"/>
      <ModalActions onCancel={onClose} onSave={submit} saveLabel="Add debt" saveTestId="debt-save-btn" />
    </Modal>
  );
}

// ============== Payment Modal ==============
function PaymentModal({ debt, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const submit = () => {
    if (!amount || parseFloat(amount)<=0 || !date) return;
    onSave(debt.id, { amount: parseFloat(amount), date, note });
  };
  return (
    <Modal title={`Log payment · ${debt.name}`} onClose={onClose} testid="payment-modal">
      <FormInput label="Amount paid ($)" data-testid="pay-amount-input" type="number" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
      <FormInput label="Date" data-testid="pay-date-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      <FormInput label="Note (optional)" data-testid="pay-note-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. extra payment"/>
      <ModalActions onCancel={onClose} onSave={submit} saveLabel="Log payment" saveTestId="pay-save-btn" />
    </Modal>
  );
}

// ============== Bucket Modal ==============
function BucketModal({ bucket, onClose, onSave }) {
  const [name, setName] = useState(bucket?.name || '');
  const [pct, setPct] = useState(bucket?.pct || '');
  const [colour, setColour] = useState(bucket?.colour || BUCKET_COLOURS[0]);
  const submit = () => {
    if (!name.trim() || !pct || parseFloat(pct)<=0) return;
    onSave({ name: name.trim(), pct: parseFloat(pct), colour }, bucket?.id);
  };
  return (
    <Modal title={bucket ? 'Edit bucket' : 'Add bucket'} onClose={onClose} testid="bucket-modal">
      <FormInput label="Name" data-testid="bucket-name-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Emergency Fund"/>
      <FormInput label="Percentage (%)" data-testid="bucket-pct-input" type="number" step="0.5" min="0.5" max="100" inputMode="decimal" value={pct} onChange={e=>setPct(e.target.value)} placeholder="e.g. 10"/>
      <div className="mb-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-1.5 block">Colour</label>
        <div className="grid grid-cols-6 gap-2">
          {BUCKET_COLOURS.map(c => (
            <button key={c} type="button" onClick={()=>setColour(c)} data-testid={`bucket-color-${c}`}
              className={`w-full aspect-square rounded-full transition-transform ${colour===c ? 'ring-2 ring-offset-2 ring-ink scale-110' : ''}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <ModalActions onCancel={onClose} onSave={submit} saveLabel={bucket ? 'Save changes' : 'Add bucket'} saveTestId="bucket-save-btn" />
    </Modal>
  );
}
