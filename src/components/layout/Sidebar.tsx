import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  FlaskConical,
  ClipboardCheck,
  ScrollText,
  BarChart3,
  ShieldAlert,
  Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'Agent Registry', icon: Bot },
  { to: '/playground', label: 'Playground', icon: FlaskConical },
  { to: '/approvals', label: 'HITL Approvals', icon: ClipboardCheck },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText },
  { to: '/incidents', label: 'Incidents', icon: ShieldAlert },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
          <Shield className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">Aegis OS</p>
          <p className="text-[11px] font-medium text-slate-400">AI Agent Governance</p>
        </div>
      </div>

      <div className="px-3">
        <div className="px-2 pb-2 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Workspace
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            A
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-slate-900">Admin User</p>
            <p className="truncate text-xs text-slate-500">admin@aegis.os</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
