import { WORDLE_WORDS } from './wordleWords'

/**
 * The word list behind Codeword: common English words of 2 to 7 letters plus cruise and travel words, upper case. A puzzle is built only
 * from these words and is solved only with them, so every answer is a word a guest will know. Place names are left out of the five-letter set.
 */
const PLACES = new Set(['SPAIN', 'ITALY', 'MALTA', 'CRETE', 'ARUBA', 'JAPAN', 'CHINA', 'INDIA', 'EGYPT', 'KENYA', 'PARIS', 'TOKYO', 'DUBAI', 'SITKA', 'CORFU', 'HAITI', 'SAMOA', 'TONGA', 'GHANA', 'CHILE', 'BAYOU', 'SOUKS'])

const TWO = 'am an as at ax be by do go he hi if in is it me my no of oh on or ox so to up us we'

const THREE = `ace act add age aid aim air ale all and ant any ape arc are arm art ash ask ate awe axe bad bag ban bar bat bay bed bee bet big bin bit boa bow box boy bud bug bun bus but buy
cab can cap car cat cod cot cow cry cub cup cut dad dam day den dew did dig dim dip dog dot dry due dug ear eat eel egg elf elk elm emu end era eve ewe eye fan far fat fed fee few fig fin fir fit fix
fly fog for fox fry fun fur gap gas gem get gin got gum gun gut guy gym had ham has hat hay hen her hid him hip his hit hog hop hot how hub hug hut ice ill ink inn ion ire ivy jam jar jaw jay jet jig
job jog jot joy jug keg key kid kin kit lab lad lag lap law lay led leg let lid lie lip lit log lot low mad man map mat may men met mix mob mop mud mug nap net new nil nod nor not now nun nut oak oar
oat odd oil old one our out owe owl own pad pan par pat paw pay pea peg pen pet pie pig pin pit ply pod pot pry pub pun pup put rag ram ran rat raw ray red rib rid rig rim rip rob rod row rub rug rum
run sad sag sat saw say sea see set sew she sip sir sit six ski sky sly sob son sow spa spy sub sue sum sun tab tag tan tap tar tax tea ten the tie tin tip toe ton too top tow toy try tub tug urn use
van vat vet via vow war was wax way web wed wet who why wig win wit woe won woo yak yam yes yet you zip zoo`

const FOUR = `arch area army aunt away back bait bake ball band bank bark barn base bath bead beam bean bear beat beef been beer bell belt bend best bike bill bird bite blow blue boat body bold bolt bomb bond
bone book boot born boss both bowl bulb bull burn busy cafe cage cake call calm came camp cane cape card care cart case cash cast cave cell chat chef chip city clam clap clay clip club coal coat code
coin cold come cook cool copy cord core corn cost cozy crab crew crop crow cube curl cute damp dare dark dart data date dawn days deal dear deck deep deer desk dial dice diet dine dirt dish dive dock
doll done door down draw drew drip drop drum duck dune dusk dust duty each earn ease east easy echo edge else even ever exam exit face fact fade fair fall farm fast fate fear feed feel feet fell felt
file fill film find fine fire firm fish fist five flag flat flew flip flow foam fold folk food foot fork form fort free frog from fuel full fund gain game gate gaze gear gift girl give glad glow glue
goal goat gold golf gone good grab gray grew grid grin grip grow gulf hail hair half hall hand hang hard harm hate have head heal hear heat heel held help herb herd hero hide high hike hill hint hire
hold hole home hood hook hope horn host hour huge hunt hurt icon idea inch into iron isle item jail jazz join joke jump june jury just keen keep kick kill kind king kiss kite knee knew knit knob knot
know lace lack laid lake lamb lamp land lane last late lawn lazy lead leaf lean leap left lend less life lift like lime line link lion list live load loaf loan lock loft lone long look loop lord lose
loss lost loud love luck lung made maid mail main make mall many mark mask mast mate maze meal mean meat meet melt menu mesh mild mile milk mill mind mine mint miss mist moat mode mold mood moon more
moss most moth move much must myth nail name navy near neat neck need nest news next nice nine node noon norm nose note numb oath obey odds okay once only onto open oral oval oven over pace pack page
paid pail pain pair palm park part pass past path pave peak pear peel peer pick pier pile pine pink pipe plan play plea plot plug plum plus poem poet pole poll pond pony pool poor pork port pose post
pour pray pull pump pure push quay quit quiz race rack raft rage raid rail rain ramp rank rare rate read real rear reef rely rent rest rice rich ride ring rink riot rise risk road roam roar rock rode
role roll roof room root rope rose rude rule rush rust safe sage said sail sale salt same sand sang save seal seat seed seek seem seen self sell send sent shed shin ship shoe shop shot show shut sick
side sigh sign silk sing sink site size skin skip slam sled slid slim slip slow snow soak soap soar sock sofa soft soil sold sole some song soon sort soul soup sour span spin spot star stay stem step
stir stop such suit sure surf swam swan swap swim tack tail take tale talk tall tame tank tape task taxi team tear tell tent term test text than that them then they thin this tide tidy tied tile time
tiny tire toad told toll tomb tone took tool tour town toys trap tray tree trim trip true tube tuna tune turn twin type unit upon used user vast very view vine visa void vote wade wage wait wake walk
wall want warm warn wash wave weak wear week well went wept were west what when whom wide wife wild will wind wine wing wink wire wise wish with wolf wood wool word wore work worm wrap yard yarn year
yell yoga yolk your zeal zero zest zone zoom`

const FIVE = `about above adult after again ahead alive allow alone along angle angry apple apron arise award aware basic begin below bench birth black blade blame blank blaze blend bless blind block blood
bloom boost booth brain brake brand brave break brick bride brief bring broad brown brush build bunch burst cable candy cargo catch cause chain chalk charm chart chase cheap check chest chief child
choir civil claim clean clear clerk climb close coach count court cover crack crane crash crazy crowd crown crush cycle daily dairy depth doubt dozen draft drain drama dream dress dried drift drive
early earth eight elite empty enjoy enter equal error event every exact exist faith false fancy fault field fifth fifty fight final first fixed flash floor flour fluid focus force forth frame fresh
front frost fruit funny giant glass glory grace grade grain grand grant grass great green greet group guard guess habit happy harsh heart heavy horse house human humor ideal image index inner ivory jewel
joint joker judge juicy kayak knife knock label large laser later layer learn lease least leave legal level limit loose lower lucky lunch major maker march match maybe mayor medal media merit metal might
minor model money month moral motor mount mouse mouth naked never newly night noble noise north noted novel nurse offer often opera orbit order other outer owner paint panel paper peace pearl phase phone
pilot pitch place plain plant plate point pound power press price pride prime print prior proof proud prove queen quick quiet quilt quite quota quote raise range rapid ratio reach ready refer reply right
rival robot rough round royal rural scale scare scope score sense serve seven shade shake shall shape share sharp sheet shelf shift shine shirt shock shoot short shout shown since skill sleep slice slope
small smart smile smoke solid solve sorry sound south space spare speak speed spell spend split spoon sport staff stair stake stand start state steel stick still stock stone stood store story strip stuck
study stuff style sugar super sweep swift swing table taste teach teeth thank their theme there these thick thing think third those three threw throw tight timer tired title today tooth topic total touch
tough track trade treat trend trial tribe trick truck truly trust truth twice uncle under union unite until upper upset urban usage usual value video virus vital voice wagon waste watch water wheat
wheel where which while white whole whose woman world worry worse worst worth would write wrong young youth zebra`

const SIX = `anchor island harbor bridge cruise docked sailor sunset ticket window beacon breeze basket butter castle cheese circle coffee cotton dancer desert dinner doctor double dragon family finger
flight flower forest friend garden gentle golden guitar hammer height jacket jungle kitten ladder lagoon legend listen market memory mirror moment mother nature number orange palace parade pepper picnic
planet pocket rabbit reason resort screen season second shadow silver simple sister spring square stream street summer sunday temple thirty travel tunnel turtle valley voyage wallet winter wonder yellow
zipper beauty breath bright canvas carpet center chance choice cookie corner couple decide demand energy engine expert fabric frozen future galley global ground health honest joyful jigsaw lounge luxury
manage middle minute mobile modern normal object office oxygen period person plenty police safety sample select shrimp signal strong sudden supply system talent theory thrill tropic velvet volume wealth
wizard zenith jaguar`

const SEVEN = `captain harbour sunrise holiday climate crystal fashion quarter relaxed anchors balcony banquet bathing bedroom cabinet capital central certain channel chicken classic comfort compass
concert cottage country cruiser destiny dolphin explore express fantasy feature freedom gallery glacier harvest healthy journey kitchen leopard library machine manager massage morning mystery natural
package passage penguin picture private quality quickly rainbow receipt seafood seagull shelter showers shopper surface sunbeam terrace theatre tourist tropics uniform veranda voyager weather welcome
windows wrapped zipline jackpot`

/** The lists above are written in lower case; the game uses upper case. */
const split = (s: string): string[] => s.toUpperCase().split(/\s+/).filter(Boolean)

/** Every word, upper case, no repeats, 2 to 7 letters. */
export const CODEWORD_WORDS: readonly string[] = [...new Set([...split(TWO), ...split(THREE), ...split(FOUR), ...WORDLE_WORDS.filter((w) => !PLACES.has(w)), ...split(FIVE), ...split(SIX), ...split(SEVEN)])]
