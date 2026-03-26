export const dynamic = 'force-dynamic';

import DashboardShell from './DashboardShell';

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}