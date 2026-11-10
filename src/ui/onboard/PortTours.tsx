import { Link } from 'react-router'
import type { TourToday } from '../../api/types'
import { formatTime } from '../../domain/cruise'
import { PORTS } from '../../domain/sailings'
import { t, th } from '../../i18n'
import { QrCode } from '../checkin/QrCode'

/** The day's tours with a code for each guest that works with no signal. */
export function Tours({ tours, port }: { tours: TourToday[]; port: string }) {
  return (
    <section aria-labelledby="tours-h">
      <h2 id="tours-h">{th('port.tours')}</h2>
      {tours.length === 0 ? <p>{t('port.noTours', { port: PORTS[port as keyof typeof PORTS]?.name ?? port })} <Link to="/plan/excursions">{t('route.excursions')}</Link></p> : (
        <ul className="card-grid">
          {tours.map((x) => (
            <li key={x.id} className="card">
              <h3 className="card__title">{x.name}</h3>
              <p className="muted">{t('port.tourOperated')}</p>
              <ul className="tour__facts">
                <li>{t('port.meet', { time: formatTime(x.start) })}</li>
                <li>{x.meeting}</li>
                <li>{t('port.backBy', { time: formatTime(x.backBy) })}</li>
                {x.tender && <li>{t('port.tenderTour')}</li>}
              </ul>
              <div className="qr-row">
                {x.guests.map((g) => (
                  <figure key={g.id} className="qr-fig">
                    <QrCode text={g.code} label={t('port.qr', { name: g.name, tour: x.name })} className="pass__qr" />
                    <figcaption>{g.name}</figcaption>
                  </figure>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
