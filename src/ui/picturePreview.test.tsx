// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const upload = vi.fn(async () => ({ id: '0b7a1c52-2f3d-4e0a-9c11-5a1f3b9d7e10', purpose: 'book', ref: '1', kind: '', caption: '', width: 1, height: 1, status: 'approved', at: 1, mine: true }))
vi.mock('../runtime', () => ({ guestMedia: { upload: (...a: unknown[]) => (upload as (...x: unknown[]) => unknown)(...a), remove: vi.fn() } }))

import { PicturePicker } from './media/Pictures'

afterEach(() => { cleanup(); upload.mockClear() })

describe('MOB-25 preview before sending', () => {
  it('shows the picture and sends nothing until the guest taps send; choose another discards it', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    const onSaved = vi.fn()
    render(<PicturePicker purpose="book" reference="1" ready onSaved={onSaved} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
    await screen.findByAltText('Preview of the picture you chose')
    expect(upload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(/choose another/i, { selector: 'button' }))
    expect(screen.queryByAltText('Preview of the picture you chose')).toBeNull()
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(await screen.findByText(/send this picture/i, { selector: 'button' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(upload).toHaveBeenCalledTimes(1)
  })
})
