# Games Explorer plan

The Games Explorer (`/games-explorer`, screen X30) lists every game; each game has its own page under `/games-explorer/<id>` and its own screen id.
Built so far: **Cruise Wordle** (X31), **Sudoku** (X32), **Diagonal Sudoku** (X33) and **Jigsaw Sudoku** (X34), **Killer Sudoku** (X35), **Binairo** (X36) and **Futoshiki** (X37) and **KenKen** (X38). Sudoku is the design reference for every game below: level picker, New puzzle, timer with clock
icon, Hint (mistakes first, then the next logical move with its reason, Fill it in, dismissable), Undo, Notes, red cells for anything that can no longer be
solved, solved card, "How to Play" panel under the game, phone-first (large touch targets, digit pad, no hover-only controls), keyboard support, spoken cell labels.

Rules for every phase (from CLAUDE.md): one phase per session, English only, verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build`
only (no browser testing, no `dotnet test`), commit and stop after the phase so the user can `/clear`. Nothing is stored on the server or the device; a game is
lost when the page is left (thin-client rule). Do not start the next phase until asked.

## Every game's checklist (the wiring)

1. Framework-free logic in `src/domain/games/<game>.ts` with `<game>.test.ts` (node tests): generator, solver, uniqueness, hint finder. Seeded random for tests.
2. A puzzle must have exactly one solution and be solvable by human logic without guessing (the Sudoku generator is the model: remove a clue, keep the removal only if still unique and still logic-solvable at the level).
3. Screen in `src/ui/explorer/games/<Game>Screen.tsx`, styles appended to `src/styles/games.css` (class prefix per game, no CSS framework, themes via existing tokens, colour is never the only cue).
4. Register: `GAMES` in `src/domain/games/catalogue.ts` (+ icon in `GamesExplorerScreen.tsx` `ICONS`), route in `src/routes/routes.ts`, screen in `src/routes/screens.ts` and `src/screens.ts`, `src/domain/offlineContract.ts` (`offline`), icon in `src/ui/icons.ts` and `src/ui/screenIcons.ts`, allow-lists and counts in `src/routes/nav.test.ts`, `coverage.test.ts` (SCREEN_LIST length and unreachable list) and `screens.test.ts` (length and unreachable list, twice).
5. Strings in `src/i18n/locales/enCore.ts` (`screen.X##.*`, `route.*`, `gx.game.*`, game keys) and `enLate.ts` (three `tip.X##` and four `stanley.q/a/r.pg.X##.n` with answers of 70+ characters; every key must be used as a literal `t('...')`, so no built-up key names).
6. Timers only through `startVisibleInterval`; a bare `setTimeout` needs the file adding to the allow-list in `src/perf.test.ts` and must be cleared on unmount.

## Phases

### G1: shared game kit, Diagonal Sudoku (X33), Jigsaw Sudoku (X34) — built

Built as planned. `sudoku.ts` takes a `Rules` object (`makeRules`, `CLASSIC`, `DIAGONAL`; `generatePuzzle(level, random, variant)` returns `rules` with the puzzle); `jigsawRegions` makes the layouts and `fullGrid` has a node budget. Shared UI is in `src/ui/explorer/games/parts.tsx` (`useGameClock`, `GameClock`, `GameHelp`, `LevelBar`, `HintBox`, `SolvedCard`) with `game-*` CSS. `SudokuScreen.tsx` exports `SudokuScreen`, `DiagonalSudokuScreen` and `JigsawSudokuScreen`.

- Extract the shared pieces from Wordle and Sudoku into `src/ui/explorer/games/parts.tsx`: `GameHelp` (How to Play panel), clock hook and `GameClock`, `LevelBar`, `HintBox` (with dismiss), `SolvedCard`. Move the matching CSS to shared `game-*` classes. Wordle and Sudoku use them.
- Generalise `src/domain/games/sudoku.ts` to take a `Rules` object (units with a kind: row, column, box, diagonal, region; peers; region id per cell; overlapping unit pairs) with the classic rules as the default so existing callers and tests still work. Make locked-candidate logic generic over overlapping units. Add a node budget to the full-grid search.
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

### G6: Kakuro (X39)

- Crossword-style grid. Clue cells carry a down and an across sum in a diagonally split cell; white cells take 1 to 9 with no repeat in a run, and each run adds to its sum. Levels by grid size (6x6 to 10x10) and run length.
- Generator: random symmetric black-cell layout with runs of 2 to 9, fill with digits, compute sums, solve for uniqueness; add given digits or re-roll the layout when it is not unique. Logic: the combination tables for a sum and length, intersection of two runs.
- Hint shows the combination (for example "16 in 2 cells is 7 and 9"). Highest-risk generator, so build and test it first.

### G7: Codeword (X40)

- Crossword grid where every letter is a number 1 to 26; a few letters are revealed. The player works out the code, with an A to Z key strip that shows which number each letter has and which are used.
- Needs a word source: curate a compact English word list (common words of 2 to 7 letters, plus cruise and travel words) as a TypeScript module, checking the bundle size; load the Codeword screen lazily as the other screens are.
- Generator: symmetric block layout, fill with words from the list so most of the alphabet appears, assign a random letter to number code, reveal letters until the solution is unique and logic-solvable (pattern and word-list reasoning). Hint reveals a letter with the word it completes.

### G8: polish and review

- Games Explorer cards show level range, players and a rough time for each game; solo and multi-player sections stay as they are.
- Consistency pass across all nine games: timer, hint, level picker, How to Play, solved card, keyboard and screen reader labels, contrast in every theme, reduced motion, small phones (320px wide).
- Remove any duplicated code left from the earlier games, update this plan, run the full npm checks.
