/** Ship information (OB-06): the captain's announcement for a cruise day. Where the ship is and the sea around it come from the server (`src/feeds/navigation.ts`). */
const ANNOUNCEMENTS: readonly string[] = [
  'Welcome aboard. We are under way for the western Caribbean and expect a smooth first night.',
  'A full day at sea. The pools are open, and the Piazza has music from noon.',
  'Good morning from the bridge. We are alongside early; please watch the all-aboard time posted at the gangway.',
  'We are anchored off the port today. Tenders run from the Atrium; priority groups are called first.',
  'Another warm day ahead. Please take the all-aboard time from your app, and remember sun protection ashore.',
  'Back at sea. The clocks went back an hour overnight; the app already shows ship time.',
  'Our last full day. Luggage tags are in the cabin, and the final night guide is in the app.',
  'We are alongside in Fort Lauderdale. Disembarkation groups are called from the Piazza.',
]

/** The captain's announcement for a cruise day, 1 to 8. A day out of range is held to the nearest end. */
export function captainAnnouncement(rawDay: number): string {
  return ANNOUNCEMENTS[Math.min(8, Math.max(1, Math.round(rawDay))) - 1]
}
