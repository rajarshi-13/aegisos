import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { useOrganization } from '@/context/OrganizationContext'
import { getAnalytics, TIME_WINDOWS, type AnalyticsResult, type TimeWindow, type VerdictCategory } from '@/lib/analytics'

const VERDICT_COLORS: Record<VerdictCategory, string> = {
  Allow: '#10b981',
  'Require Approval': '#f59e0b',
  Deny: '#f43f5e',
  Governance: '#6366f1',
}

const metricCards = [
  { key: 'actionsInWindow', label: 'Actions in window', icon: Activity, accent: 'text-brand-600 bg-brand-50' },
  { key: 'actionsPerMin', label: 'Actions / minute', icon: Gauge, accent: 'text-sky-600 bg-sky-50' },
  { key: 'incidentsInWindow', label: 'Incidents in window', icon: ShieldAlert, accent: 'text-rose-600 bg-rose-50' },
  { key: 'heldDeniedShare', label: 'Held / denied share', icon: TrendingUp, accent: 'text-amber-600 bg-amber-50' },
] as const

export function Analytics() {
  const { currentOrg } = useOrganization()
  const [window, setWindow] = useState<TimeWindow>('24H')
  const [data, setData] = useState<AnalyticsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAnalytics(currentOrg.id, window)
      setData(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to load analytics: ${err.message}`
          : 'Unable to load analytics. Check your Supabase configuration.',
      )
    } finally {
      setLoading(false)
    }
  }, [currentOrg.id, window])

  useEffect(() => {
    load()
  }, [load])

  const formatMetric = (key: string, value: number) => {
    if (key === 'heldDeniedShare') return `${value}%`
    return value.toLocaleString()
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={`Governance and activity analytics for ${currentOrg.name}.`}
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">Time window:</span>
        {TIME_WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              window === w
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      {error && !loading && (
        <div className="card mb-4 flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Could not load analytics</p>
              <p className="mt-0.5 text-sm text-slate-500">{error}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon
          const value = data ? (data[card.key] as number) : 0
          return (
            <div key={card.key} className="card p-5">
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold text-slate-900">
                {loading ? '—' : formatMetric(card.key, value)}
              </p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Activity Over Time</h2>
          </div>
          <div className="h-72 w-full">
            {loading || !data ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : data.activityOverTime.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No activity in this window
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.activityOverTime} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="allowedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="heldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="allowed" stackId="1" stroke="#10b981" fill="url(#allowedGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="held" stackId="1" stroke="#f43f5e" fill="url(#heldGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Incidents Over Time</h2>
          </div>
          <div className="h-72 w-full">
            {loading || !data ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : data.incidentsOverTime.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No incidents in this window
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.incidentsOverTime} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="incidents" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Verdict Mix</h2>
          </div>
          <div className="h-72 w-full">
            {loading || !data ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : data.verdictMix.every((v) => v.value === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No verdicts in this window
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.verdictMix.filter((v) => v.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.verdictMix.map((entry) => (
                      <Cell key={entry.name} fill={VERDICT_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Most Active Agents</h2>
          </div>
          <div className="h-72 w-full">
            {loading || !data ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : data.mostActiveAgents.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No agent activity in this window
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.mostActiveAgents}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="actions" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
