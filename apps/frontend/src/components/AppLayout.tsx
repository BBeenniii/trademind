import { Activity, BarChart3, Bell, Brain, BrainCircuit, Gauge, LineChart, Radio } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/live', label: 'Live', icon: Radio },
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/signals', label: 'Signals', icon: Activity },
  { to: '/backtest', label: 'Backtest', icon: BarChart3 },
  { to: '/ai-summary', label: 'AI Summary', icon: Brain },
  { to: '/models', label: 'Model Lifecycle', icon: BrainCircuit },
  { to: '/alerts', label: 'Alerts', icon: Bell }
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-transparent text-ink">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-line bg-[#0d1117] px-4 py-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-buy/40 bg-buy/10 p-2 text-buy">
            <LineChart size={20} />
          </div>
          <div>
            <p className="text-base font-semibold">TradeMind AI</p>
              <p className="text-xs text-muted">Live FX research</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex h-10 items-center gap-3 rounded-md px-3 text-sm transition ${
                  isActive ? 'bg-panelSoft text-ink' : 'text-muted hover:bg-panelSoft/70 hover:text-ink'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-[#0b0f14]/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">EUR/USD live research workspace</p>
              <p className="text-xs text-muted">Live feed, ML signals, paper trading and alert workflow</p>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs text-muted">
              Paper mode: no real trade execution
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm ${
                    isActive ? 'border-buy/40 bg-buy/10 text-buy' : 'border-line bg-panel text-muted'
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 md:px-6">
          <Outlet />
        </main>

        <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted md:px-6">
          This project is a technical demonstration and research prototype. It does not execute real trades and does not provide financial advice.
        </footer>
      </div>
    </div>
  );
}