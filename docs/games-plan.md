# Games Explorer plan

The Games Explorer (`/games-explorer`, screen X30) lists every game; each game has its own page under `/games-explorer/<id>` and its own screen id.
Built so far: **Cruise Wordle** (X31), **Sudoku** (X32), **Diagonal Sudoku** (X33) and **Jigsaw Sudoku** (X34), **Killer Sudoku** (X35), **Binairo** (X36) and **Futoshiki** (X37), **KenKen** (X38), **Kakuro** (X39), **Codeword** (X40) **Hitori** (X41) and **Word Search** (X42) and **Slitherlink** (X43) and **Crossmath** (X44) and **Nonogram** (X45) and **Minesweeper** (X46) and **Hashi** (X47), **Nurikabe** (X48) and **Battleship** (X49, the first game against the computer). All eighteen games are built. Sudoku is the design reference for every game below: level picker, New puzzle, timer with clock
icon, Hint (mistakes first, then the next logical move with its reason, Fill it in, dismissable), Undo, Notes, red cells for anything that can no longer be
solved, solved card, "How to Play" panel under the game, phone-first (large touch targets, digit pad, no hover-only controls), keyboard support, spoken cell labels.

Rules for every phase (from CLAUDE.md): one phase per session, English only, verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build`
only (no browser testing, no `dotnet test`), commit and stop after the phase so the user can `/clear`. Nothing is stored on the server or the device; a game is
lost when the page is left (thin-client rule). Do not start the next phase until asked.

## Every game's checklist (the wiring)

1. Framework-free logic in `src/features/games/domain/<game>.ts` with `<game>.test.ts` (node tests): generator, solver, uniqueness, hint finder. Seeded random for tests.
2. A puzzle must have exactly one solution and be solvable by human logic without guessing (the Sudoku generator is the model: remove a clue, keep the removal only if still unique and still logic-solvable at the level).
3. Screen in `src/features/explorer/ui/games/<Game>Screen.tsx`, styles appended to `src/styles/games.css` (class prefix per game, no CSS framework, themes via existing tokens, colour is never the only cue).
4. Register: `GAMES` in `src/features/games/domain/catalogue.ts` (+ icon in `GamesExplorerScreen.tsx` `ICONS`), route in `src/app/routes/routes.ts`, screen in `src/app/routes/screens.ts` and `src/app/screens.ts`, `src/domain/offlineContract.ts` (`offline`), icon in `src/shared/ui/icons.ts` and `src/shared/ui/screenIcons.ts`, allow-lists and counts in `src/app/routes/nav.test.ts`, `coverage.test.ts` (SCREEN_LIST length and unreachable list) and `screens.test.ts` (length and unreachable list, twice).
5. Strings in `src/shared/i18n/locales/enCore.ts` (`screen.X##.*`, `route.*`, `gx.game.*`, game keys) and `enLate.ts` (three `tip.X##` and four `stanley.q/a/r.pg.X##.n` with answers of 70+ characters; every key must be used as a literal `t('...')`, so no built-up key names).
6. Timers only through `startVisibleInterval`; a bare `setTimeout` needs the file adding to the allow-list in `src/gates/perf.test.ts` and must be cleared on unmount.

## Phases

### G1: shared game kit, Diagonal Sudoku (X33), Jigsaw Sudoku (X34) — built

Built as planned. `sudoku.ts` takes a `Rules` object (`makeRules`, `CLASSIC`, `DIAGONAL`; `generatePuzzle(level, random, variant)` returns `rules` with the puzzle); `jigsawRegions` makes the layouts and `fullGrid` has a node budget. Shared UI is in `src/features/explorer/ui/games/parts.tsx` (`useGameClock`, `GameClock`, `GameHelp`, `LevelBar`, `HintBox`, `SolvedCard`) with `game-*` CSS. `SudokuScreen.tsx` exports `SudokuScreen`, `DiagonalSudokuScreen` and `JigsawSudokuScreen`.

- Extract the shared pieces from Wordle and Sudoku into `src/features/explorer/ui/games/parts.tsx`: `GameHelp` (How to Play panel), clock hook and `GameClock`, `LevelBar`, `HintBox` (with dismiss), `SolvedCard`. Move the matching CSS to shared `game-*` classes. Wordle and Sudoku use them.
- Generalise `src/features/games/domain/sudoku.ts` to take a `Rules` object (units with a kind: row, column, box, diagonal, region; peers; region id per cell; overlapping unit pairs) with the classic rules as the default so existing callers and tests still work. Make locked-candidate logic generic over overlapping units. Add a node budget to the full-grid search.
- **Diagonal (Sudoku X):** classic rules plus both main diagonals must hold 1 to 9. Tint the diagonal cells; hint wording for the diagonal.
- **Jigsaw:** nine irregular connected regions of nine cells replace the 3x3 boxes. Layout generator: start from the boxes and swap neighbouring cells between regions while both stay connected; retry the layout when the budgeted full-grid search fails. Thick borders drawn from region boundaries (not nth-child), so classic uses the same code.
- Both reuse `SudokuScreen` (a `variant` prop); each gets its own route, screen id, catalogue entry, How to Play text, tips and Stanley answers.
- Tests: uniqueness and logic-solvability per level for both variants, region connectivity and size, diagonal constraint, conflicts/dead cells/hints with the variant rules.

### G2: Killer Sudoku (X35) — built

Built as planned, with one change: the generator needs no guessing search. `killer.ts` cuts a full grid into cages, adds given digits until the logic solver (singles, cage-sum pruning from a combination table, and at hard and expert the 45 rule for innies and outies) finishes, then takes back unneeded givens down to the level's minimum; a puzzle that logic finishes is unique. `Rules` gained `cages` and `cageOf` (cage mates are peers); `SudokuScreen.tsx` has a `killer` variant with its own engine (`killerConflicts`, `killerDeadCells`, `nextKillerHint`) and dotted cage outlines drawn from cage boundaries.

- Classic rules plus cages: connected groups of 1 to 5 cells with a target sum, no digit repeated inside a cage. Dotted cage outlines with the sum in the top-left corner of the cage.
- Generator: full grid, random cage partition, sums from the solution; levels change cage sizes and how many digits are given. Uniqueness by a solver that prunes with cage sums; logic solver adds cage rules (cage combinations for a sum, the 45 rule for rows, columns and boxes).
- Hints name the cage (for example "This 2-cell cage sums to 3, so it holds 1 and 2"). Dead cells include a cage whose sum can no longer be reached.

### G3: Binairo (X36) — built

Built as planned. `binairo.ts` builds a full grid row by row from balanced rows with column checks, then removes givens while plain logic (pair, gap, half-full line, and at medium and up the rows-must-differ rule) still solves it, so the answer is unique with no guessing. Easy leaves out the rows-must-differ rule. `BinairoScreen.tsx`: tap cycles empty, circle, square; two-button pad with remaining counts; keys 0/c and 1/s.

- Grid of 0 and 1 (shown as two clearly different shapes, not only colours). No more than two of the same symbol in a row or column, equal numbers of each in every row and column, and no two rows or no two columns identical.
- Levels by size and clues: Easy 6x6, Medium 8x8, Hard 10x10, Expert 12x12. Tap a cell to cycle empty, 0, 1; pad for phones; given cells locked.
- Generator: random valid full grid by backtracking, then clue removal with uniqueness and logic checks (avoid triples, fill a line once one symbol has its half, uniqueness of rows). Hints explain which of those rules applies. Red marks for a triple, an over-full line or a duplicate line.

### G4: Futoshiki (X37) — built

Built as planned. `futoshiki.ts` makes a Latin square by backtracking, shows every sign (plus givens only if logic needs them), then takes away signs and givens one at a time while plain logic still solves it (easy keeps 4 givens, medium 4, hard 3, expert none), so the answer is unique with no guessing. Logic is candidate elimination by row and column, sign bounds pushed to a fixed point (so chains work), naked singles and hidden singles; a move that needs the signs is reported as `sign` (naming the neighbouring sign that forces it) or `signRow`/`signColumn`. `FutoshikiScreen.tsx`: separate squares with the signs drawn in the gaps (turned to point up or down between rows), notes, digit pad with remaining counts, red squares for repeats and dead squares, a circled broken sign, and spoken labels that name each sign next to a square.

- N by N Latin square (each digit once per row and column) with greater-than and less-than signs between neighbouring cells, and a few given digits. Levels: 4x4, 5x5, 6x6, 7x7.
- Generator: Latin square, a random set of inequality signs, givens removed while unique. Logic solver: candidate elimination by the signs, naked and hidden singles, chains of signs.
- Signs drawn between cells (rotated for vertical), notes, hint explains the sign that forces a digit. Red marks for a broken sign, repeated digit or a cell with no candidates.

### G5: KenKen (X38) — built

Built as planned. `kenken.ts` reuses `latinSquare` and `linesOf` from Futoshiki. It cuts the square into connected cages (one-cell cages are givens, subtract and divide only on two cells), then adds extra given digits until plain logic finishes and takes back any that are not needed, so the answer is unique with no guessing. Logic is row and column elimination, cage tuple pruning to a fixed point, naked and hidden singles; hints name the cage, its target and the digits it can still use. Levels: Easy 4x4, Medium 5x5, Hard 6x6, Expert 7x7 (generates in milliseconds). `KenKenScreen.tsx` draws bold cage outlines with the target and sign in the corner, notes, digit pad with counts, red squares for repeats, broken cages and dead squares.

- N by N Latin square with bold cages, each showing a target and an operation (add, subtract, multiply, divide; subtract and divide only on two-cell cages; one-cell cages are givens). Levels: 4x4 up to 6x6 (Expert 7x7 if it generates quickly).
- Generator: Latin square, random cage partition, choose an operation that suits each cage, solve for uniqueness. Hints name the cage and the combinations left.
- Reuses the Futoshiki and Killer pieces (cage outlines, Latin-square rules, notes).

### G6: Kakuro (X39) — built

Built as planned. `kakuro.ts` makes a point-symmetric layout (first row and column black, runs 2 to the level's longest, white squares joined), fills it by backtracking, reads the sums off, then reveals digits until plain logic finishes and takes back any that are not needed (the best of up to 24 layouts, fewest givens), so the answer is unique with no guessing. Logic is the combination tables per run plus a run-by-run reach pass (a small DP over used-digit sets, exact for runs up to 9) repeated across crossing runs. Hint tiers: last empty square in a run, crossing runs' digit lists meeting in one digit, then the deeper pass; the text shows each run as "16 in 2 squares can only be 7 and 9". Levels: Easy 6x6 (runs to 4), Medium 8x8 (5), Hard 9x9 (7), Expert 10x10 (9); easy and medium keep a few givens. `KakuroScreen.tsx`: diagonal clue squares, selected square's two runs tinted, notes, digit pad, red squares for broken runs and dead squares.

- Crossword-style grid. Clue cells carry a down and an across sum in a diagonally split cell; white cells take 1 to 9 with no repeat in a run, and each run adds to its sum. Levels by grid size (6x6 to 10x10) and run length.
- Generator: random symmetric black-cell layout with runs of 2 to 9, fill with digits, compute sums, solve for uniqueness; add given digits or re-roll the layout when it is not unique. Logic: the combination tables for a sum and length, intersection of two runs.
- Hint shows the combination (for example "16 in 2 cells is 7 and 9"). Highest-risk generator, so build and test it first.

### G7: Codeword (X40) — built

Built as planned. `codewordWords.ts` holds about 1,680 words of 2 to 7 letters (the Wordle list minus place names plus common and cruise words, a few KB in the lazy chunk). `codeword.ts` makes a point-symmetric layout (the black share and longest word set per level), fills it by a forward-checking search with a step budget (failed layouts are cheap, so it just retries), gives each letter a random number from 1 to 26, then reveals the most common numbers until word-list logic finishes and takes back any that are not needed (never below the level's minimum, so easy and medium keep several). Logic is arc-style pruning: every word that fits a slot with one letter per number and no letter shared by two numbers, repeated with the rule that a number with one letter frees that letter everywhere. Hint tiers: a slot with only one fitting word, a number the fitting words pin down, then the grid-wide step; the text shows the pattern like `_ A _ E R`. Levels: Easy 7x7, Medium 9x9, Hard 11x11, Expert 13x13. `CodewordScreen.tsx`: numbered squares, typing a letter fills every square with that number, an A to Z key strip showing each letter's number, red squares for one letter on two numbers, no Notes mode.

- Crossword grid where every letter is a number 1 to 26; a few letters are revealed. The player works out the code, with an A to Z key strip that shows which number each letter has and which are used.
- Needs a word source: curate a compact English word list (common words of 2 to 7 letters, plus cruise and travel words) as a TypeScript module, checking the bundle size; load the Codeword screen lazily as the other screens are.
- Generator: symmetric block layout, fill with words from the list so most of the alphabet appears, assign a random letter to number code, reveal letters until the solution is unique and logic-solvable (pattern and word-list reasoning). Hint reveals a letter with the word it completes.

### G8: polish and review — built

Built. Each catalogue entry now carries `levels`, `minutes` and `players`, and the explorer cards show them as a small list (levels, players, rough time). The consistency pass found all eight game screens already on the shared `parts.tsx` pieces (clock, hint box, level bar, How to Play, solved card), boards fluid with `min(100%, 30rem)` and clamped fonts, and reduced motion handled; the one duplicate left is the cage-growing loop in `killer.ts` and `kenken.ts`, kept apart because the two differ in size rules and a merge risks changing generated puzzles.

- Games Explorer cards show level range, players and a rough time for each game; solo and multi-player sections stay as they are.
- Consistency pass across all nine games: timer, hint, level picker, How to Play, solved card, keyboard and screen reader labels, contrast in every theme, reduced motion, small phones (320px wide).
- Remove any duplicated code left from the earlier games, update this plan, run the full npm checks.

## Round two (proposed, not started)

Four more games, one phase each, built in this order (easiest to riskiest). Same checklist and rules as above; screen ids X41 to X44. Each ends with a commit and a stop. A final phase repeats the G8 consistency pass for the new games and updates the explorer card counts.

### G9: Hitori (X41) — built

Built as planned. `hitori.ts` makes a Latin square, a random legal shading (no touching, rest joined; about 20 to 24% shaded), gives each shaded square a copy of a digit that stays in its row or column, and keeps the puzzle only when plain logic finishes it to that shading, so the answer is unique with no guessing (shaded squares must repeat a staying digit, the usual convention). Logic rules, also used for hints: neighbour of a shaded square stays, twin of a circled square is shaded, equal pair shades any third copy, sandwich (X Y X) keeps the middle, no twin left keeps the square, and (not on Easy) shading that would split the unshaded group. Levels: Easy 5x5, Medium 6x6, Hard 8x8, Expert 10x10 (generates in milliseconds). Solved means any legal shading. `HitoriScreen.tsx`: tap cycles blank, shaded (solid block, struck digit), circled (ring); Shade and Circle buttons; red for touching shaded squares, circled repeats or a split group.

- N by N grid of digits. Shade squares so no digit repeats in any row or column among the unshaded squares, no two shaded squares touch along a side, and all unshaded squares stay joined as one group.
- Generator: Latin-style base grid, choose a valid shading (no touching, joined whites), fill each shaded square with a copy of a digit already in its row or column, then check uniqueness with a logic solver (pair and triple rules, sandwich, corner, "shading here would split the whites" connectivity). Levels 5x5 to 9x9 (Expert 10x10 if fast).
- Tap cycles blank, shaded, circled (known to stay). Hints name the rule; red for a repeat among unshaded squares, two touching shaded squares or a split group. Shapes not colour alone for shaded and circled.

### G10: Word Search with no spare letters (X42) — built

Built with this answer rule: the grid has no filler. Every square is covered by a listed word (words cross and share letters) except a few answer squares, which hold a hidden cruise word (5 to 8 letters by level) in reading order. Find every listed word and the squares left unmarked spell the answer, shown on the solved card. `wordSearch.ts` picks the answer squares, then packs words by a budgeted search that always covers the first uncovered square (themed words first, a sample of common Codeword words as fill), and rejects any layout where a listed word also hides over an answer square, so the leftover squares are exactly the answer. `wordSearchWords.ts` holds about 330 themed words and the answers. Levels: Easy 6x6 (4 directions), Medium 8x8 (6), Hard 10x10 and Expert 12x12 (all 8); about 0.2 s to generate. `WordSearchScreen.tsx`: drag, tap first then last letter, or keyboard (arrows, Shift-arrows start a selection, Enter marks first and last, Escape clears); found squares are tinted and underlined, found words struck off the list; Hint names the first letter, position, length and direction of the next word and Fill it in marks it.


- Every letter of the grid belongs to a word; no filler. Words run in all 8 directions and may cross. When all words are found, the letters that belong to no listed word are none, so the answer is instead a hidden phrase: the letters left uncovered after crossing off the word list at the start form it (Wonderword style: found words are cleared, and the leftover letters read as the answer). Decide the exact answer rule when the phase starts.
- Needs a themed word list (cruise and travel, plus common words) in a lazy module, as for Codeword. Generator: pack words into a grid to cover every square (search with a step budget, retry), place the answer letters in the squares left over.
- Drag or tap-first-then-last to select; keyboard cursor with Shift-arrows; found words struck off the list; a hint highlights the first letter of a word. Levels by grid size and word length.

### G11: Slitherlink (X43) — built

Built as planned. `slitherlink.ts` grows a random region of squares (joined, no holes, no pinch points, about 50 to 65% of the board) and takes its boundary as the loop, writes a number in every square, then removes numbers one at a time while plain logic still finds the whole loop, so the answer is unique with no guessing (Easy removes at most 30% of the numbers, Medium 60%, Hard and Expert as many as possible). Logic rules, also used for hints: a number with all its lines crosses the rest, a number that needs every open side draws them, a dot with two lines crosses the rest, a dot with one line and one way on continues, a dot with no line and one way is crossed, two adjacent 3s, 1 and 3 in a corner, never close a small loop while other lines remain, and cross everything once the loop is closed and every number met. Levels: Easy 5x5, Medium 7x7, Hard 8x8, Expert 10x10 (generates in about 10 ms or less). `SlitherlinkScreen.tsx` draws the dots, numbers and lines in SVG with an overlay of invisible buttons over each edge (roving tab stop, arrow keys step to the nearest edge, L, X, Space, Backspace); tap cycles empty, line, cross; Line and Cross buttons; red for a dot with three lines or a dead end, a number over-filled or out of reach, and a closed loop that is not the whole answer; numbers are read out in the label of each edge beside them.


- Dot grid with numbers in some squares; draw one single closed loop along the dot lines so every number says how many of its four sides the loop uses. Levels 5x5 to 10x10 squares.
- Generator: grow a random loop (random region of squares with a single boundary, no holes), write the numbers, remove clues while a logic solver (3s and 0s, adjacent 3s, corner rules, degree-two and degree-one dots, loop-closing) still finishes. Uniqueness comes from the logic solver, no guessing.
- Tap an edge to cycle line, cross (known no line), empty; large invisible hit areas for phones; red for a dot with 3 lines, a number over-filled or a closed loop that is too short. Highest-risk generator: build and test it first.

### G12: Crossmath (X44) — built

Built as planned, with equations of the form `a sign b = c` (signs and "=" always shown; only numbers are blank). `crossmath.ts` grows a tree of equations that cross at number squares and touch nothing else, fills them with random true equations, then blanks numbers one at a time while the allowed logic still fills the grid, so the answer is unique with no guessing. Logic, also used for hints: an equation with one blank (plain arithmetic), a blank where only one tray number keeps every equation through it completable, and a tray number that fits exactly as many squares as it has copies left. Levels: Easy add and subtract to 20 (arithmetic only), Medium adds times to 30, Hard all four signs to 50, Expert to 99 (all generate in under 100 ms). `CrossmathScreen.tsx`: tap a blank then a tray key (count of copies left), or type digits (two digits typed in turn); arrows jump to the nearest blank; red squares for a full equation that is not true; labels read both equations through a square.

- A crossword-style grid of numbers and signs (+, -, x, /) where each row and column reads as a true equation; some squares are given, the player fills the rest from a number tray (each tray number used once).
- Generator: build equations on a grid, cross them so shared squares agree, blank out squares while the answer stays unique and plain logic (the only fit for a square, the last tray number) finishes. Levels by grid size, number range and which signs appear (Easy add and subtract to 20, Expert all four signs to 99).
- Tray of numbers with counts, tap a blank then a tray number, keyboard digits. Hints show the equation with one blank. Red for a broken equation.

## Round three (proposed)

Four more popular single-player logic puzzles in the same vein: each needs a generator whose puzzles have one answer that plain logic finds, rule-naming hints, red marks for broken rules, four levels and phone-first controls. Screen ids continue from X45. Build the riskiest generator first inside each phase. Reserve options if one is dropped: Skyscrapers (Latin square with edge visibility clues, reuses Futoshiki and KenKen pieces), Cryptogram (themed cruise quote, reuses the Codeword word lists and keyboard), Light Up and Masyu.

### G13: Nonogram (X45) — built

Built as planned. `nonogram.ts` makes a blobby picture (random noise smoothed by neighbourhood majority, 35 to 75% filled, no empty line), writes the clues, and keeps it only if the line solver fills the whole grid, so the answer is unique with no guessing. `lineOptions` is an exact dynamic-programming solver for one line (checked against brute force in the tests); the grid solver repeats it over every row and column. Hints name the line and the reason: a 0 clue, runs that fill the line exactly, all runs already placed, the overlap of long runs, or the marks already made. Levels: Easy 5x5, Medium 8x8, Hard 10x10, Expert 15x15 (all generate in a few milliseconds). `NonogramScreen.tsx`: Fill and Cross tools, tap toggles, dragging paints a straight line (the first square decides paint or clear; the drag is one undo step), thicker lines every five squares, clues turn grey when their line is complete and red when it cannot be met, keyboard arrows with F, X, Space and Backspace. The release-gate drag test lists the screen, as tapping and keys do everything a drag does.


- Numbers beside each row and column give the lengths of the runs of filled squares, in order. Fill or cross squares to reveal a picture. Levels 5x5 to 15x15 (Easy 5x5, Medium 8x8, Hard 10x10, Expert 15x15).
- Generator: random picture (blobby regions so it looks like a shape, not noise), clues from the picture, kept only if a line solver (overlap, edge, gap and complete-run rules, repeated to a fixed point) fills the whole grid, so the answer is unique with no guessing. Retry when it stalls.
- Tap cycles empty, filled, crossed; Fill and Cross buttons and drag to paint a line for phones; clue numbers turn grey once their run is complete and red when impossible. Hints name the line and the rule. Keyboard cursor with arrows, F, X, Backspace.

### G14: Minesweeper, no guessing (X46) — built

Built with one change: the opening square is chosen when the puzzle is made (not at the first tap), so the board is known to be logic-solvable and a patch is already open when it appears. `minesweeper.ts` places the mines at random outside the start square and its neighbours, and keeps the board only if `solvableByLogic` opens every safe square. Logic (also used for hints): a number whose mines are all found makes the rest of its neighbours safe, a number whose hidden squares equal the mines it still needs makes them all mines, the subset rule between two numbers, and the total mine count. Levels: Easy 8x8 with 10 mines, Medium 10x10 with 17, Hard 12x14 with 32, Expert 16x16 with 48 (all generate in a few milliseconds). `MinesweeperScreen.tsx`: Open and Flag tools, touch long-press (the shared `useLongPress`) or right click flags, tapping an open number whose flags match chords, mines-left counter, Undo; opening a mine stops the board, shows the mines and waits for Undo or New puzzle; numbers whose flags cannot be right turn red (wavy underline) with a red ring on the flags around them; Hint names wrong flags first, then the number or numbers behind the next certain square, and can open or flag it. Keyboard: arrows, Space or Enter, F, Backspace.

- Reveal every safe square without touching a mine; each number counts the mines in the eight squares around it. Levels: Easy 8x8, Medium 10x10, Hard 12x14, Expert 16x16, mine density about 12 to 20%.
- Generator: place mines after the first reveal (the first square and its neighbours are safe), then accept the board only if a logic solver (single-square counts, subset rule between neighbouring numbers, total mine count at the end) can finish it from there, so no guess is ever needed. Retry otherwise.
- Tap reveals, long-press or the Flag button flags (flag shapes, not colour alone); chord on a satisfied number; mines-left counter; hint points at a safe square or a certain mine and names the rule. Red for a flag that contradicts a number. Highest-risk generator: build and test it first.

### G15: Hashi, bridges (X47) — built

Built as planned. `hashi.ts` grows a connected layout (each new island is placed 2 to 7 squares from an existing one along an empty line, never touching another island, then a few extra loop bridges are added), writes the numbers from the planted bridges and keeps the puzzle only if `propagate` settles every link to the planted answer, so it is unique with no guessing. Logic is bounds propagation on each link's allowed counts (0, 1 or 2): an island needing everything its neighbours can give (`all`), needing the rest of its number on one link (`least`), or full so no more (`room`); no bridge across a certain one (`cross`); and no count that would close a finished group off from the rest (`link`). A 1 next to a 1 and a 2 in a corner come out of these. Levels: Easy 7x7 with 10 islands, Medium 9x9 with 16, Hard 11x11 with 25, Expert 15x15 with 42. `HashiScreen.tsx`: islands are buttons over an SVG layer, tap an island then a neighbour, drag between two, or tap the gap to go none, single, double; a bridge that would cross another is refused with a message; islands show done (solid), red dashed (too many or cannot reach) and dotted red (a finished group cut off). Keyboard: arrows between islands, Shift-arrow cycles the bridge that way, Enter on two islands in turn. Hint names any over-full bridge first, then the island and rule behind the next certain bridge and can draw it.

- Numbered islands on a grid; join them with horizontal or vertical bridges (at most two between a pair, none crossing) so each island has its number of bridges and all islands form one connected group. Levels 7x7 to 15x15.
- Generator: place islands, grow a connected bridge network without crossings, write the numbers, then keep only islands and numbers that a logic solver (island needs all its bridges, a 1 next to a 1, a 2 in a corner and similar forced bridges, connectivity rule) can finish.
- Tap or drag between two islands to cycle none, one, two bridges (single and double drawn as different shapes); islands show met, over and impossible states; large hit areas; keyboard arrows between islands. Hints name the island and the rule.

### G16: Nurikabe (X48) — built

Built with one change: every island has exactly one number, so there are no numbers to remove; instead the generator tries up to 25 random number positions per layout. `nurikabe.ts` starts with all wall and adds white squares into 2 by 2 blocks (a new one-square island or growth of one neighbouring island, never touching a second island, wall kept joined), then grows islands to about 40% white so there are few lone 1s, and keeps the layout only if `findMove` settles every square to the planted answer, so it is unique with no guessing. Logic (also used for hints): a square touching two numbered islands is wall (`between`), a full island is walled in (`complete`), a square no island can stretch to is wall (`reach`), the fourth square of three wall squares in a 2 by 2 is white (`block`), an island with one way out takes it (`single`), and a square that would cut the wall in two if white is wall (`wall`, not needed on Easy). Dotted groups without a number can still join an island, so those rules stay sound. Levels: Easy 5x5, Medium 7x7, Hard 9x9, Expert 10x10 (all generate in a few milliseconds). `NurikabeScreen.tsx` reuses the Hitori grid styles: tap steps empty, wall, dot; Wall and Dot buttons; red for a 2 by 2 wall, a region with two numbers, too many known white squares, an island walled in too small, or a wall that cannot be joined (only what is certain, since blanks may still change). Keyboard: arrows, W or X, D or ., Space or Enter, Backspace. Hint names wrong marks first, then the rule and squares behind the next certain square.

- Numbered squares are islands: shade the rest so each island is one white region of exactly its number size, every region holds one number, the shaded wall is one connected piece and contains no 2x2 block. Levels 5x5 to 10x10.
- Generator: grow islands and a connected wall without 2x2 blocks, write one number per island, remove numbers while a logic solver (squares next to two islands are wall, an island that is complete is walled in, unreachable squares are wall, a 2x2 would form so one square is white, wall connectivity) still finishes. Highest-risk uniqueness: build and test it first.
- Tap cycles empty, wall, dot (known white); red for a 2x2 wall, a region with two numbers or the wrong size, a split wall. Hints name the rule. Reuses the Hitori shade and circle marks and connectivity helpers.


## Battleship (X49)

Official Milton Bradley / Hasbro rules: 10 by 10, Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2, ships straight and never overlapping, alternate single shots, "sunk" is announced, first to sink the fleet wins. Our variations: board size (Small 8x8 with 4 ships, Classic, Large 12x12 with 7) and opponent (Cadet, Captain, Admiral). The engine and AI are in `features/games/domain/battleship.ts`; the AI is handed only `AiView` (its own shots and the ships it has sunk), and a test proves its choice cannot depend on unsunk ship positions. Not shareable to chat (`noShare` in the catalogue). Ideas for later: Salvo rules, a first-turn coin toss, win/loss streak on the device.

## Card games (X50 to X53): Klondike, Spider, FreeCell, Pyramid

Rules and AI-free helpers are framework-free in `features/games/domain/` (`cards.ts`, `klondike.ts`, `spider.ts`, `freecell.ts`, `pyramid.ts`, each with tests); the screens and shared pieces are in `features/explorer/ui/games/` and `.../cards/`.

- **Artwork:** `src/assets/cards/cards.svg`, built by `scripts/build-card-sprite.py` from SVG-cards (LGPL-2.1, David Bellot, Huub de Beer and contributors). All 52 faces come from the one set so the deck is consistent; the build trims the unused parts, replaces the DejaVu numeral font with a stack every phone has, and adds `edge_*` groups (card base and corner index) so overlapped cards in a column are cheap. The licence text and authors are in `public/licenses/`, and `CardCredits` (on each card screen) credits the source, states the licence and says it was modified, as the LGPL asks. Re-run the script if the sprite changes.
- **Backs:** drawn by CSS (`.pc--back`) with the Princess Voyages roundel (`assets/princess.webp`), so 100+ backs cost nothing; the sprite and roundel are precached, so everything plays offline.
- **Play:** tap a card, then where it goes; tap it again to send it to its best place; Undo is unlimited; Hint explains the move and can do it; Finish plays out a won Klondike or FreeCell.
- **Levels:** Klondike Draw 1 or 3; Spider 1, 2 or 4 suits; FreeCell 4, 3 or 2 cells (Microsoft numbered deals, all solvable except 11982, which is skipped; hints come from a best-first solver); Pyramid 3, 2 or 1 pass through the stock. TriPeaks, drag and drop, winnable-only Klondike deals are not built. Card deals can be sent to a chat by deal number (chat bundles plan, B12).

## TriPeaks (X54) and Gaps (X55)

Two more card games on the shared card parts. TriPeaks: clear three peaks by taking cards one rank above or below the waste card (Easy lets King and Ace connect). Gaps: four rows of thirteen with the Aces out; fill each gap with the next card of the same suit, a gap in the first column takes a 2, three rounds with the locked cards scoring. The board pans and pinch-zooms on a phone (`usePanZoom`).

## Board games and puzzles (X56 to X68)

Thirteen games in one pass, all drawn in SVG/CSS (no image assets), framework-free rules in `features/games/domain`, with tests.

- **Solo puzzles:** Peg Solitaire (English, French, triangle; Hint is a real search), Lights Out (4, 5 or 6 square; Hint from GF(2) elimination), 15 Puzzle (3, 4 or 5 square; Hint by weighted A*).
- **Against the computer:** Reversi, Gomoku (15x15), Pente (19x19, captures), Hex (7, 9 or 11), Nine Men's Morris, Dots and Boxes (3, 4 or 5), Fox and Geese and Brandubh (one game, either side), Mancala/Kalah (3, 4 or 6 seeds), Backgammon, Checkers.
- **One opponent scale everywhere:** Cadet, Captain, Admiral, with shared names and strings (`bd.skill.*`) and one picker (`board/SkillPicker.tsx`). Stronger opponents search deeper and also pause longer before moving (`THINK_MS` in `board/shared.ts`).
- **Fair play:** every AI works only from the position (all of these are open-information games, and Backgammon's AI is given only its own dice), and tests check that it plays legal moves and beats a random player.
- **Shared frame:** `board/VsShell.tsx` holds setup, status line, Undo (which also takes back the computer's reply), result card and How to Play.

## Dice, deduction and small-board games (X69 to X76)

Pig, Yacht, Shut the Box, Mastermind (break or make a code), Connect Four, Breakthrough, Konane and Nim, all on the shared `board/VsShell`, the Cadet / Captain / Admiral ladder, remembered choices, Hint, and a device-local record per opponent.

- **Dice games** roll fair dice in the screen; the AI sees only the dice, the scores and its own card. Pig uses hold thresholds (Cadet random, Captain 20, Admiral score-aware), Yacht the odds of every way of keeping dice for the Admiral, and Shut the Box a table of expected scores for the Admiral.
- **Mastermind** scores clues honestly; the computer as guesser sees only the clues (Cadet sometimes ignores one, Captain guesses a consistent code, Admiral picks the guess that splits the possibilities best).
- **Nim** uses the nim-sum (and the misère exception); Cadet and Captain slip with a chance of a random move.
- **Connect Four, Breakthrough, Konane** use the shared alpha-beta `search.ts`.

## Consistency pass

One opponent ladder everywhere (Battleship included, `bd.skill.*`); choices (opponent, size, side, who moves first) remembered per game in `shared/settings/gamePrefs.ts`; Hint on every opponent game; records and a nudge to the next opponent after three clean wins; daily puzzle for Lights Out and 15 Puzzle; catalogue cards say sizes, opponents and variants from `facets`; filters and Surprise me on the explorer page. Not done: handicaps, a quick-game toggle, numbered deals for the other card games, sound and haptics.
