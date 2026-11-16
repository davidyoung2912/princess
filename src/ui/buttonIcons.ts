import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft, ArrowRight, Ban, Bell, BellOff, CalendarCheck, CalendarPlus, Camera, Check, CreditCard, Copy, Download, Flag, Heart, LifeBuoy, LogIn, LogOut,
  Map as MapIcon, MessageCircle, Pencil, Phone, Pin, Plus, Printer, RefreshCw, Scale, Search, Send, Share2, ShoppingBag, SkipForward, Ticket, Trash2, Undo2, Upload, UserPlus, X,
} from 'lucide-react'

/** The icon a button's words call for: the first rule whose words match. Order matters, the specific before the general. */
const RULES: readonly (readonly [RegExp, LucideIcon])[] = [
  [/\b(delete|remove|discard|erase|forget)\b/i, Trash2],
  [/\b(cancel|decline|dismiss|close|not now|no thanks|clear|hide|stop|leave|turn off)\b/i, X],
  [/\b(block)\b/i, Ban],
  [/\b(report|flag)\b/i, Flag],
  [/\b(mute)\b/i, BellOff],
  [/\b(remind|notify|alert|notification)/i, Bell],
  [/\b(undo|restore|revert)\b/i, Undo2],
  [/\b(retry|try again|refresh|reload|sync|check again|reset)\b/i, RefreshCw],
  [/\b(sign in|log in|login|join|enter)\b/i, LogIn],
  [/\b(sign out|log out|logout)\b/i, LogOut],
  [/\b(invite|connect|follow|add (a )?(person|friend|guest|traveller|member))/i, UserPlus],
  [/\b(calendar)\b/i, CalendarPlus],
  [/\b(book|reserve|reservation|schedule|reschedule|plan my|appointment)\b/i, CalendarCheck],
  [/\b(pay|checkout|card|charge|tip|purchase|buy|deposit)\b/i, CreditCard],
  [/\b(order|basket|cart|shop)\b/i, ShoppingBag],
  [/\b(check[- ]?in|boarding|ticket|pass|board)\b/i, Ticket],
  [/\b(download|export|save (a )?(copy|file|pdf))/i, Download],
  [/\b(upload|attach|import)\b/i, Upload],
  [/\b(photo|picture|camera|scan)\b/i, Camera],
  [/\b(print)\b/i, Printer],
  [/\b(copy)\b/i, Copy],
  [/\b(share|send to)\b/i, Share2],
  [/\b(send|submit|post|reply|publish)\b/i, Send],
  [/\b(call|phone|ring|dial)\b/i, Phone],
  [/\b(chat|message|ask|stanley|talk|write to|contact)\b/i, MessageCircle],
  [/\b(help|support|assist)\b/i, LifeBuoy],
  [/\b(search|find|look up|look for)\b/i, Search],
  [/\b(map|directions|deck plan|navigate|where)\b/i, MapIcon],
  [/\b(compare)\b/i, Scale],
  [/\b(heart|favourite|favorite|like|love|save)\b/i, Heart],
  [/\b(pin)\b/i, Pin],
  [/\b(edit|change|rename|update|modify|move|swap|adjust|customi[sz]e|set up|settings)\b/i, Pencil],
  [/\b(add|new|create|more|another|extra|plus)\b/i, Plus],
  [/\b(skip|later|maybe|next time)\b/i, SkipForward],
  [/\b(back|previous|return)\b/i, ArrowLeft],
  [/\b(confirm|accept|agree|done|ok|okay|yes|got it|approve|apply|save|finish|complete|allow|keep|continue|ready|use this|choose|select|pick)\b/i, Check],
]

/** The words a button shows, when they are only text; null when it holds other elements (an icon of its own) or nothing. */
export function labelText(children: unknown): string | null {
  const parts = Array.isArray(children) ? children : [children]
  let out = ''
  for (const c of parts) {
    if (typeof c === 'string' || typeof c === 'number') out += String(c)
    else if (c === null || c === undefined || c === false || c === true) continue
    else return null
  }
  const text = out.trim()
  return text.length > 0 ? text : null
}

/** The icon for a button: by its words, else an arrow for a link that goes somewhere or a tick for an action. */
export function buttonIcon(label: string, link: boolean): LucideIcon {
  for (const [re, icon] of RULES) if (re.test(label)) return icon
  return link ? ArrowRight : Check
}
