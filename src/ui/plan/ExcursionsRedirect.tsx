import { Navigate } from 'react-router'

/** The old Excursions page: tours are browsed, carted, paid and managed in the Excursions Explorer, on the whole-trip view (kept so saved links, Stanley's links and notifications still arrive). */
export function ExcursionsRedirect() {
  return <Navigate to="/excursions-explorer?view=trip" replace />
}
