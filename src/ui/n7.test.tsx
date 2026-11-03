import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { KeptPicture, PicturePicker } from './media/Pictures'
import { BookPagePictures, DayPictureEditor } from './account/BookPictures'
import { CabinPhotos } from './discover/CabinPhotos'
import type { Media } from '../domain/media'

const m: Media = { id: '0b7a1c52-2f3d-4e0a-9c11-5a1f3b9d7e10', purpose: 'book', ref: '2', kind: '', caption: 'Dinner on the Piazza', width: 640, height: 480, status: 'approved', at: 1, mine: true }
const render = (node: React.ReactNode): string => renderToString(<MemoryRouter>{node}</MemoryRouter>)

describe('clear-to-use sentences (N7)', () => {
  it('the picker says what happens to the picture before anything is sent, and why it is off', () => {
    const html = render(<PicturePicker purpose="cabin" reference="balcony" ready={false} blockedWhy="Tick that you stayed in this type of room to add a picture." onSaved={() => undefined} />)
    expect(html).toContain('Choose a picture')
    expect(html).toContain('made smaller on your phone')
    expect(html).toContain('the place and time your camera wrote into it are removed')
    expect(html).toContain('accept="image/jpeg,image/png"')
    expect(html).toContain('disabled')
    expect(html).toContain('Tick that you stayed in this type of room')
  })

  it('cabin pictures: states that a picture is checked first, that yours are always yours, and that the guest must say they stayed', () => {
    const html = render(<CabinPhotos category="balcony" />)
    expect(html).toContain('Pictures of This Room Type: Deluxe Balcony')
    expect(html).toContain('A picture is checked before anyone else can see it')
    expect(html).toContain('may not show other guests’ pictures yet')
    expect(html).toContain('delete them whenever you like')
    expect(html).toContain('I stayed in this type of room')
    expect(html).toContain('What the picture shows')
    expect(html).toContain('Something in the way')
  })

  it('a kept picture can be deleted and always has words for a screen reader', () => {
    const html = render(<KeptPicture media={m} alt={m.caption} onDeleted={() => undefined} />)
    expect(html).toContain('Delete This Picture')
    expect(html).toContain('Dinner on the Piazza')
    const theirs = render(<KeptPicture media={{ ...m, mine: false }} alt="x" onDeleted={() => undefined} />)
    expect(theirs).not.toContain('Delete this picture')
  })

  it('memory book: each day offers to add a picture, and says where it stays', () => {
    const html = render(<DayPictureEditor day={3} list={[m]} onChange={() => undefined} />)
    expect(html).toContain('Add a picture to day 3')
    const cover = render(<DayPictureEditor day="cover" list={[]} onChange={() => undefined} />)
    expect(cover).toContain('Add a picture to the front of the book')
    expect(render(<BookPagePictures day={9} list={[m]} />)).toBe('')
    expect(render(<BookPagePictures day={2} list={[m]} />)).toContain('Dinner on the Piazza')
  })
})
