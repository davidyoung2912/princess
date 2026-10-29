import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { LoadError } from '../discover/parts'

/** The page a "finish later" link opens: back into the saved draft, or a plain explanation when the link no longer matches (BOK-01). */
export function ResumeScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const stored = useMine(async () => ({ draft: await api.booking.draft() }))
  const match = stored.status === 'ready' && stored.data?.draft?.id === id
  useEffect(() => { if (match) navigate('/book', { replace: true }) }, [match, navigate])
  return (
    <div className="page">
      <h1>{t('route.bookResume')}</h1>
      {stored.status === 'error' && !stored.data ? <LoadError retry={stored.retry} /> : null}
      {stored.status === 'loading' || match ? <p role="status" className="muted">{t('book.resume.opening')}</p> : null}
      {stored.status === 'ready' && !match && (
        <Banner kind="warning" title={t('book.resume.gone')} action={<LinkButton to="/book" variant="secondary">{t('book.resume.start')}</LinkButton>}>
          <p>{t('book.resume.goneBody')}</p>
        </Banner>
      )}
    </div>
  )
}
