import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { Cloud, CloudDrizzle, CloudLightning, CloudMoon, CloudRain, CloudSun, Droplets, Eye, Gauge, Moon, Sun, Thermometer, Wind } from '../icons'
import { chartRange, pressureText, tempText, tempValue, uvBand, visibilityText, weekdayOf, windText, type Condition, type ShipWeather, type WeatherDay } from '../../domain/weather'
import type { Units } from '../../domain/readiness'
import { PORTS, type PortId } from '../../domain/sailings'
import { weatherFeed } from '../../feeds/weather'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { useFeed } from '../../hooks/useServedFeeds'
import { t, th, type StringKey } from '../../i18n'
import { compassWord } from './navigationText'

const HOUR = 3_600_000

type Icon = ComponentType<SVGProps<SVGSVGElement>>
const DAY_ICONS: Record<Condition, Icon> = { sunny: Sun, partlyCloudy: CloudSun, cloudy: Cloud, showers: CloudDrizzle, rain: CloudRain, storm: CloudLightning }
const NIGHT_ICONS: Record<Condition, Icon> = { ...DAY_ICONS, sunny: Moon, partlyCloudy: CloudMoon }

const conditionWord = (c: Condition): string => t(`ship.wx.cond.${c}` as StringKey)
const placeName = (place: string): string => (place === 'sea' ? t('onb.atSea') : (PORTS[place as Exclude<PortId, 'sea'>]?.name ?? place))

/** Weather at sea: the weather at the ship now and the forecast for the rest of the sailing, as a picture and in words. */
export function WeatherScreen() {
  const [settings] = useSettings()
  const sailing = useSailing()
  const w = useFeed(weatherFeed, sailing.id, Math.floor(useNow() / HOUR) * HOUR)
  return (
    <div className="page">
      <p>{t('ship.wx.intro')}</p>
      {!w && <FeedWaiting />}
      {w && <Body w={w} units={settings.units} />}
      <p><Link to="/nautical">{t('route.nautical')}</Link></p>
    </div>
  )
}

function Body({ w, units }: { w: ShipWeather; units: Units }) {
  const c = w.current
  const Icon = (c.daylight ? DAY_ICONS : NIGHT_ICONS)[c.condition]
  const uv = uvBand(c.uvIndex)
  return (
    <>
      <Card hero labelledBy="wx-now">
        <h2 id="wx-now" className="card__title">{th('ship.wx.now', { place: placeName(w.place) })}</h2>
        <p className="wx-hero"><Icon className="wx-hero__icon" aria-hidden="true" /> <span className="wx-hero__temp">{tempText(c.tempC, units)}</span></p>
        <p className="wx-big">{conditionWord(c.condition)}</p>
        <p className="muted">{t('ship.wx.feels', { temp: tempText(c.feelsLikeC, units) })}</p>
        <dl className="facts wx-facts">
          <div><dt><Wind aria-hidden="true" /> {t('ship.wx.wind')}</dt><dd>{t('ship.wx.wind.value', { speed: windText(c.windKnots, units), from: compassWord(c.windFrom), gust: windText(c.gustKnots, units) })}</dd></div>
          <div><dt><Droplets aria-hidden="true" /> {t('ship.wx.humidity')}</dt><dd>{c.humidityPercent}%</dd></div>
          <div><dt><CloudRain aria-hidden="true" /> {t('ship.wx.rain')}</dt><dd>{c.rainChancePercent}%</dd></div>
          <div><dt><Cloud aria-hidden="true" /> {t('ship.wx.cloud')}</dt><dd>{c.cloudPercent}%</dd></div>
          <div><dt><Gauge aria-hidden="true" /> {t('ship.wx.pressure')}</dt><dd>{pressureText(c.pressureHpa, units)}</dd></div>
          <div><dt><Eye aria-hidden="true" /> {t('ship.wx.visibility')}</dt><dd>{visibilityText(c.visibilityKm, units)}</dd></div>
          <div><dt><Sun aria-hidden="true" /> {t('ship.wx.uv')}</dt><dd>{c.uvIndex === 0 ? t('ship.wx.uv.none') : t('ship.wx.uv.value', { index: c.uvIndex, band: t(`ship.wx.uv.${uv}` as StringKey) })}</dd></div>
        </dl>
      </Card>

      <section aria-labelledby="wx-forecast">
        <h2 id="wx-forecast">{th('ship.wx.forecast')}</h2>
        {w.forecast.length === 0 ? <p className="muted">{t('ship.wx.forecast.none')}</p> : (
          <>
            <p className="muted">{t('ship.wx.forecast.count', { count: w.forecast.length })}</p>
            <TempChart days={w.forecast} units={units} />
            <ol className="wx-days">
              {w.forecast.map((d, i) => <DayRow key={d.day} d={d} units={units} first={i === 0 && w.day === d.day} />)}
            </ol>
          </>
        )}
      </section>
    </>
  )
}

const W = 320
const H = 140
const PAD = { l: 8, r: 8, t: 14, b: 14 }

/** High and low temperatures for each forecast day as two lines. The days below carry the same figures in words, so the picture is hidden from a screen reader behind a one-line summary. */
function TempChart({ days, units }: { days: WeatherDay[]; units: Units }) {
  const { min, max } = chartRange(days, units)
  const x = (i: number): number => (days.length === 1 ? W / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (days.length - 1))
  const y = (v: number): number => PAD.t + ((max - v) * (H - PAD.t - PAD.b)) / (max - min)
  const line = (pick: (d: WeatherDay) => number): string => days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(tempValue(pick(d), units)).toFixed(1)}`).join(' ')
  const hottest = days.reduce((a, d) => (d.highC > a.highC ? d : a))
  const label = t('ship.wx.chart.aria', { count: days.length, high: tempText(hottest.highC, units), day: weekdayOf(hottest.date), low: tempText(Math.min(...days.map((d) => d.lowC)), units) })
  return (
    <figure className="wx-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} focusable="false">
        <path className="wx-chart__high" d={line((d) => d.highC)} fill="none" />
        <path className="wx-chart__low" d={line((d) => d.lowC)} fill="none" />
        {days.map((d, i) => (
          <g key={d.day}>
            <circle className="wx-chart__dot wx-chart__dot--high" cx={x(i)} cy={y(tempValue(d.highC, units))} r="3.5" />
            <circle className="wx-chart__dot wx-chart__dot--low" cx={x(i)} cy={y(tempValue(d.lowC, units))} r="3.5" />
            <text className="wx-chart__t" x={x(i)} y={y(tempValue(d.highC, units)) - 6} textAnchor="middle">{Math.round(tempValue(d.highC, units))}°</text>
            <text className="wx-chart__t" x={x(i)} y={y(tempValue(d.lowC, units)) + 13} textAnchor="middle">{Math.round(tempValue(d.lowC, units))}°</text>
          </g>
        ))}
      </svg>
      <figcaption className="wx-chart__key"><span className="wx-key wx-key--high">{t('ship.wx.high')}</span> <span className="wx-key wx-key--low">{t('ship.wx.low')}</span></figcaption>
    </figure>
  )
}

function DayRow({ d, units, first }: { d: WeatherDay; units: Units; first: boolean }) {
  const Icon = DAY_ICONS[d.condition]
  return (
    <li className="wx-day">
      <p className="wx-day__head">
        <Icon className="wx-day__icon" aria-hidden="true" />
        <strong>{first ? t('ship.wx.today') : weekdayOf(d.date)}</strong> <span className="muted">{t('plan.day', { n: d.day })} · {placeName(d.place)}</span>
      </p>
      <p><Thermometer aria-hidden="true" /> {conditionWord(d.condition)}, {t('ship.wx.hiLo', { high: tempText(d.highC, units), low: tempText(d.lowC, units) })}</p>
      <p className="muted">{t('ship.wx.day.detail', { rain: d.rainChancePercent, wind: windText(d.windKnots, units), from: compassWord(d.windFrom) })}</p>
    </li>
  )
}
