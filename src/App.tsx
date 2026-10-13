import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Overview } from '@/pages/Overview'
import { AgentRegistry } from '@/pages/AgentRegistry'
import { Playground } from '@/pages/Playground'
import { HITLApprovals } from '@/pages/HITLApprovals'
import { AuditTrail } from '@/pages/AuditTrail'
import { Analytics } from '@/pages/Analytics'
import { Incidents } from '@/pages/Incidents'

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'agents', element: <AgentRegistry /> },
      { path: 'playground', element: <Playground /> },
      { path: 'approvals', element: <HITLApprovals /> },
      { path: 'audit', element: <AuditTrail /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'incidents', element: <Incidents /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
