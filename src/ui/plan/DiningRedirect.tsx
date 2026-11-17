import { Navigate } from 'react-router'

/** The old Dining page: dinners are managed in the Dining Explorer, on the whole-trip view (kept so saved links, Stanley's links and notifications still arrive). */
export function DiningRedirect() {
  return <Navigate to="/dining-today?view=trip" replace />
}
