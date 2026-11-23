import sprite from '../../../../../assets/cards/cards.svg?url'
import { SUIT_NAMES, spriteId, type Card } from '../../../../games/domain/cards'
import { t } from '../../../../../shared/i18n'

/** The card artwork: one SVG sprite bundled with the app, so every card draws offline. */
export const CARD_SPRITE: string = sprite

/** A card is 169.075 by 244.64 in the artwork. */
export const CARD_RATIO = 244.64 / 169.075

export const cardHref = (c: Pick<Card, 'suit' | 'rank'>, edge: boolean): string => `${CARD_SPRITE}#${edge ? 'edge_' : ''}${spriteId(c)}`

/** "Seven of hearts", for screen readers and hints. */
export const cardName = (c: Pick<Card, 'suit' | 'rank'>): string => t('cd.name', { rank: t(`cd.rank.${c.rank}` as never), suit: t(`cd.suit.${SUIT_NAMES[c.suit]}` as never) })
