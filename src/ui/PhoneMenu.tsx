import { useState } from 'react'
import { Link } from 'react-router'
import stanley from '../assets/stanley-small.png'
import logo from '../assets/princess.webp'
import { artUrl } from '../art/urls'
import { t, th } from '../i18n'
import { Dialog } from './Dialog'
import { DialogHeader } from './DialogHeader'
import { Help, Menu, MessagesSquare, Search } from './icons'

/**
 * The menu button at the right of the date bar on phones and tablets, where there is no top bar or side nav: Search, Ask Stanley, Help and the account.
 * It opens as a sheet, so the bars cost no more room than a single small button.
 */
export function PhoneMenu({ chatCount = 0, stanleyOff, dot, onStanley, onHelp }: { chatCount?: number; stanleyOff: boolean; dot: boolean; onStanley: () => void; onHelp: () => void }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <>
      <button type="button" className="phone-menu__button no-print" data-tour="menu" aria-label={dot ? `${t('shell.menu')}. ${t('stanley.dot')}` : t('shell.menu')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" />
        {dot && <span className="stanley-dot" aria-hidden="true" />}
      </button>
      {open && (
        <Dialog title={t('shell.menu.title')} onClose={close} header={(titleId) => <DialogHeader titleId={titleId} title={t('shell.menu.title')} subtext={t('shell.menu.sub')} icon={Menu} onClose={close} />}>
          <ul className="phone-menu__list">
            <li><Link to="/ship/search" className="phone-menu__item" onClick={close}><Search aria-hidden="true" /><span>{t('shell.search')}</span></Link></li>
            <li><Link to="/chat" className="phone-menu__item" onClick={close}><MessagesSquare aria-hidden="true" /><span>{t('route.chat')}{chatCount > 0 && <span className="visually-hidden">. {t('people.tabBadge', { count: chatCount })}</span>}</span></Link></li>
            {!stanleyOff && (
              <li>
                <button type="button" className="phone-menu__item" onClick={() => { close(); onStanley() }}>
                  <img src={artUrl({ kind: 'head', id: 'sherlock' }) ?? stanley} alt="" width="192" height="192" />
                  <span>{th('stanley.button')}{dot && <span className="visually-hidden">. {t('stanley.dot')}</span>}</span>
                </button>
              </li>
            )}
            <li><button type="button" className="phone-menu__item" onClick={() => { close(); onHelp() }}><Help aria-hidden="true" /><span>{th('help.button')}</span></button></li>
            <li><Link to="/account" className="phone-menu__item" onClick={close}><img src={logo} alt="" width="512" height="512" /><span>{t('account.logo')}</span></Link></li>
          </ul>
        </Dialog>
      )}
    </>
  )
}
