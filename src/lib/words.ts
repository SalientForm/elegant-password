// Word pools for the sentence grammar: 2,242 words in total. Every word is
// lowercase a-z, 3-8 letters, easy to remember, and fits its slot. The
// lists were hand-written and spell-checked against the dwyl english-words
// list. A 2026-10-15 review swapped 169 hard-to-type, uncommon words for
// easier ones ("tweedy", "fjords", "squirt"); memorable words were then
// added back on top ("unicorns", "narwhals", "zap"), since any easy-to-
// remember word is valid. 107 of the 169 came back that way. Of the other
// 62, three were restored once deliberate swaps for typing ease existed
// (ease.ts), as their swap puts them inside the balanced comfort share:
// "blazing" (blasing), "bleak" (bleek) and "seize" (seise). No swap helps
// the rest enough, so they stay out.
//   ADJECTIVES   describe a plural noun     ("sleepy")
//   NOUNS        plural, subject or object  ("otters")
//   VERBS        transitive, plural present ("paint")
//   ADVERBS      sit before the verb        ("gently")
//   ENDINGS      close the sentence         ("tonight")
//   PREPOSITIONS open a trailing phrase     ("near")

const list = (words: string): readonly string[] => words.trim().split(/\s+/);

export const ADJECTIVES = list(`
  active adult aged agile airy alert alien alpine amazing amber ample
  ancient annual anxious apt arctic arid assorted atomic avid awful awkward
  azure baked bald bare barren basic beige big bitter black blank blazing
  bleak blessed blind blue blunt bold boring bouncy brave breezy brief
  bright brisk broad broken bronze brown bubbly bulky bumpy busy buttery
  calm candid careful
  casual catchy central charming chatty cheap cheeky cheerful cheery chewy
  chic chief chilly chirpy choppy chubby chunky civil classic clean clear
  clever close cloudy coastal cobalt cold comfy comic common compact complex
  cool copper coppery coral cosmic costly cozy cracked crafty cranky creamy
  creepy crimson crisp crooked crunchy crusty cubic cuddly cunning curious
  curly curved cute daft dainty damp dapper daring dark dashing dear decent
  deep dense deserted devoted digital dim direct dirty distant divine dizzy
  double dramatic dreamy dressy dried drippy droopy dry dual dull dusky
  dusty dynamic eager early earthy eastern easy elastic elated electric
  elegant emerald empty endless enormous entire epic equal eternal ethereal
  even exact excited exotic expert extra faded fair famous fancy fast faulty
  feisty fertile festive fierce fiery filthy final fine firm fit fizzy flaky
  flashy flat flighty floppy floral flowery fluent fluffy flying foamy foggy
  fond foolish foreign formal fragile frail frank free fresh frilly frisky
  frosty frothy frozen frugal fruity full funky funny furry fuzzy gallant
  gentle genuine ghostly giant giddy gifted glad gleaming gleeful glittery
  global gloomy glossy glowing gnarly golden good gooey gorgeous graceful
  grand grassy grateful grave gray great greedy green grim gritty groovy
  grumpy hairy handy happy hardy harsh hasty healthy hearty heated heavy
  helpful heroic hidden high hollow holy honest hopeful hot huge humble
  hungry husky icy ideal idle immense indigo inner instant iron itchy ivory
  jade jagged jazzy jealous jittery jolly jovial joyful jubilant juicy jumpy
  keen khaki kind kindly kooky lacy large lasting late lazy leafy lean legal
  level light lilac limp liquid little lively local lofty lone lonely long
  loopy loose loud lovely loyal lucky lumpy lunar lush magenta magic
  majestic major marble maroon massive mature medieval meek mellow merry
  messy metal mighty mild milky minor minty misty mobile modern modest
  molten moody mossy muddy murky mushy musical mute mystic narrow native
  natural naughty nautical navy neat needy neon nervous new nice nifty
  nimble noble noisy normal novel obvious odd offbeat oily old olive opaque
  orange ornate outdoor outer oval padded painted pale paper pastel patient
  peppery peppy perfect perky petite petty pewter pink plaid plain playful
  pleasant plucky plump plush pointy poised polar polished polite poor
  popular portly posh potent powdery powerful precious preppy pretty prime
  private prompt proper proud puffy pure purple quaint quick quiet quirky
  radiant ragged rainy rapid rare raw ready real reckless red reedy regal
  regular relaxed remote retro rich rigid ripe robust rocky rosy rotten
  rough round rowdy royal rubbery rugged rural rustic rusty sacred safe
  salty sandy sassy satin savvy scarlet scary scenic scruffy secret selfish
  sensible serene serious severe shabby shady shaggy shallow sharp shiny
  short shy silent silky silly silver simple sincere skilled skinny sleek
  sleepy slender slim slippery sloppy slow sly small smart smoky smooth smug
  snappy sneaky snowy snug sober social soft soggy solar solid sonic
  soothing sooty sour spare sparkly speedy spicy spiky spiral splendid
  spooky sporty spotted spotty spry spunky square squeaky squishy stable
  starry steady steep stellar stern sticky stiff still stony stormy stout
  strange streaky strict striped stripy strong stubborn stuffy stunning
  sturdy sublime subtle sudden sugary sunlit sunny super superb sweet swift
  syrupy talented tall tan tangled tangy tart tasty teal teary tender tense
  terrific thick thin thirsty thorny thorough thrifty tidy tight timely
  timid tiny tired toasty torn tough toxic tranquil trendy tricky trim
  tropical troubled true trusty truthful tweedy twisty typical unique
  unusual upbeat upper upright upset urban urgent used useful usual vacant
  vague valiant valid vast velvet vibrant vintage violet visible vital vivid
  vocal volcanic wacky warm wary watery wavy wealthy weary wee weedy weighty
  weird western wet white whole wide wiggly wild willing windy winged wintry
  wiry wise witty wobbly wooden woolly worldly worn worthy woven wry yellow
  young youthful yummy zany zesty zigzag zippy
`);

export const NOUNS = list(`
  acorns acrobats actors admirals aliens almonds alpacas anchors ants anvils
  apes apples archers arrows artists asters athletes atlases aunts authors
  axes axolotls babies baboons badgers badges bagels bakers balloons bananas
  bandits banjos barbers bards barns barrels baskets batons bats beads beans
  bears beavers beds bees beetles bells belts benches berries bikes birds
  biscuits bishops bison blades blankets blimps blocks boars boats bobcats
  bolts bones bonnets books boots bottles bowls boxers boxes branches
  brewers bricks brides bridges brothers brushes bubbles buckets buckles
  builders bulbs bulls bundles bunnies burgers burritos buses butlers
  buttons cabins cables cadets cakes calves camels cameras campers canaries
  candies candles cannons canoes capes caps captains carpets carrots carts
  cashiers castles cats caves cellos centaurs chains chairs charms cheeses
  cheetahs chefs cherries chests chickens children chimneys chimps chips
  clams clerks cliffs climbers cloaks clocks clouds clovers clowns coaches
  coats cobras cobwebs coconuts coders coins collars comets cones cookies
  cooks corks cottages couches cougars cousins cowboys cows coyotes crabs
  cradles cranes crates crayons crickets critics critters crowns crows
  crystals cubes cubs cupcakes cups curtains cushions cutters dads daggers
  daisies dancers darts deer dentists desks desserts dials diamonds dice
  dingoes dishes divers doctors dogs dolls dolphins domes donkeys donuts
  doors doves dragons drawers dressers dresses drills drivers druids
  drummers drums ducks dukes eagles easels editors eels eggs elves embers
  emeralds emperors emus engines experts eyes fairies falcons fans farmers
  fathers feathers fences ferns ferrets ferries fiddles fighters figs
  finches fjords flags flasks fleas flowers flutes foals folders forests
  forks fossils foxes frames friends fries frogs gadgets galaxies gamers
  gardens garlands gates gazelles gears geckos geese gems geniuses gerbils
  ghosts giants gibbons gifts giraffes globes gloves gnomes goats goblets
  goblins golfers gongs gophers gorillas goslings gourds gowns grannies
  grapes griffins grooms guards guests guides guilds guitars guppies hammers
  hammocks hamsters hares harps hatchets hats hatters hawks hearts helmets
  hens herds hermits heroes herons hikers hills hippos hives hogs hoops
  hornets horns horses hoses hosts hounds hunters huts hyenas igloos iguanas
  impalas inkwells islands jackals jackets jaguars jars jays jeeps jesters
  jewels judges jugglers jugs kayaks kettles keys kids kings kites kittens
  kiwis knights knitters knives koalas krakens ladders ladies ladybugs lakes
  lambs lamps lanterns laptops larks lasers lawyers lemons lemurs leopards
  letters lighters limes lions litters lizards llamas lobsters lockets locks
  logs lutes lyres macaws magnets magpies mammoths manatees mangoes maps
  marbles marmots masks mats mayors meadows medals meerkats melons mermaids
  meteors mice miners minks minnows mirrors mittens moles monarchs monkeys
  monks moons mops mosaics mothers moths motors muffins mugs mules nachos
  nails nannies narwhals needles nephews nerds nests nets newts nickels
  ninjas nomads noodles nuggets nurses nuts oars oceans ocelots ogres olives
  onions operas oranges orcas ospreys otters ovens owlets owls oxen oysters
  paddles painters paints pajamas palaces pancakes pandas pans panthers
  parcels parents parrots peaches peacocks peanuts pears pebbles pegs
  pelicans pencils pendants penguins pens peppers pianos pickles piers pies
  pigeons piglets pigs pilgrims pillars pillows pilots pins pipers pipes
  piranhas pirates pistons pixies pizzas planets plants plates platters
  pliers plumbers plums pockets pods poets pointers polkas ponchos ponds
  ponies poodles poppies porters ports possums posters potatoes potions pots
  potters pretzels princes prisms puffins puffs pulleys pumas pumpkins
  puppets puppies pups purees purses putters puzzles quails queens quills
  quilts rabbits raccoons rackets radios radishes rafts rainbows rakes rams
  rangers raptors rats rattles ravens rebels reeds reefs reindeer rhinos
  ribbons riders rings rivals rivers robins robots rockets rocks rods rogues
  roosters ropes roses routes rubies rugs rulers sacks saddles safes sagas
  sages sailors sails salads sandals sardines sashes satchels satyrs saucers
  sausages scales scarves scholars scissors scones scouts scrolls seagulls
  seals seas seaweeds seeds seesaws senators servants settees sharks sheep
  shells shelves sheriffs shields ships shirts shoes shrews shrubs shutters
  sierras singers sisters skaters skates skewers skillets skirts skis skunks
  sleds sleepers slippers sloths slugs snacks snails snakes socks sofas
  soldiers sparks sparrows spices spiders spies spools spoons sprouts squids
  squires stags stamps starfish stars statues steeds stewards stickers
  stones stools storks stoves straws streets students sundaes surfers
  swallows swans sweaters sweets swimmers swings swords tables tacos
  tadpoles tailors tassels teachers teacups teapots teas temples tents
  terriers thieves thimbles thrones tiaras tickets tigers tiles tires titans
  toads toasters toffees tokens tomatoes tongs toppings torches totems
  toucans tourists towels towers toys tractors trains trays trees trolleys
  trolls trophies trousers trucks trumpets tubas tubs tulips tunnels turkeys
  turrets turtles tutors tutus tweeds twins umpires uncles unicorns urns
  valleys valves vampires vases vests vikings villages vines violins vipers
  voters vultures wafers waffles wagons waiters wallets walnuts walruses
  wands warriors washers wasps watches weasels weavers weeds wells whales
  wheels wigs wildcats windows wings witches wizards wolves wombats workers
  worms wreaths wrens writers yachts yaks yetis youths yurts zebras zippers
  zombies
`);

export const VERBS = list(`
  accept adjust admire adopt alert anchor annoy arrange assess assign award
  bag bake balance bang barter beat befriend bend bite blast blend bless
  block blow board boil bolt boost borrow bother bounce box braid brand
  break brew bring brush buckle build bump bundle burn bury butter buy cage
  call calm capture carry carve cast catapult catch charm chart chase check
  cheer chew chill chip choose chop circle clamp clean climb clip close
  clutch coat collect comfort conquer cook cool copy cork corner count cover
  crack cradle crate create crown crush cuddle cure curl cut dab dangle darn
  dazzle decorate defend deliver dent design deter dice dig dip discover
  ditch dodge drag drain draw dress dribble drill drink drive drop dry dunk
  dust dye earn eat embrace empty enjoy equip erase escort examine fan feed
  fetch fight file fill film filter find finish fix flag flavor fling flip
  float flood floss fluff fly fold follow fool forget frame free freeze
  frost fry fuel gather get gift glaze glue gnaw grab grade grease greet
  grill grind grip groom guard guide hail halt hammer hand handle hang
  harvest hatch haul heal heat help hide hire hoist hold hook host hug hunt
  ice ignite ink insert inspect invent iron jam jiggle jingle join judge
  juggle keep kick kindle knead knock label lace lasso launch lead leash
  lend lick lift light like line link load lock lose love lure mail mark
  mash master match measure meet melt milk mix mold mop mount move nail name
  net nibble note nudge nurse nurture offer oil open oppose order own pack
  paddle paint pamper parade park pass pat patch pay peck pedal peel pet
  pick pierce pile pin pinch pitch place plant play plow pluck plug plunge
  pocket point poke polish pop portray possess post pour powder praise press
  print prod prop protect puff pull pump push question quiz quote race raid
  raise rake ram ration rattle reach read reel refresh rent repair rescue
  resell reset restore retrieve reuse rev reward rewrite ride rinse rip
  roast rock roll rope rotate row rub ruffle rule sack sadden salt salute
  sand save saw scan scare scatter scoop scorch scratch screw scrub seal
  seize sell send serenade serve set sew shade shake shape share sharpen
  shear
  shell shield shine ship shoo shovel show shower shred shrink shuffle sign
  sink sip sketch skip slice sling slurp smash smell smooth snap snare
  snatch sniff snip soak sort spice spill spin splash split spoil spook spot
  spray spread spur squash squeeze squirt stack stain stalk stamp start
  steal steam steer stir stitch stock stomp store strap stretch stroke study
  stuff stun sugar summon supply suppress surprise swallow swap swat sway
  sweep sweeten swing swirl tackle tag tame tap tape taste tattoo teach
  tease tempt terrify test thank thread throw tickle tidy tie tilt tint tip
  toast topple torch toss tote touch tour tow trace track trade train
  transfer trap treat trick trigger trim trip trust tuck tug tumble tune
  tutor tweak twirl twist unleash unlock unveil unwrap use value visit wag
  wake walk want warm warn wash watch water wave wax weave wedge weed weigh
  welcome whip whisk whittle wiggle win wipe wobble wrangle wrap wrench
  write yank zap zip
`);

export const ADVERBS = list(`
  actively also always astutely badly barely bitterly boldly bravely briefly
  brightly briskly broadly busily calmly cheaply cheerily cleverly closely
  clumsily daily daintily darkly deeply deftly dimly duly eagerly easily
  eerily fairly fiercely finally firmly fondly frankly freely freshly gaily
  gently gingerly gladly gravely greedily grimly guiltily happily hastily
  heartily highly honestly humbly jauntily joyfully keenly kindly lazily
  lightly loosely loudly lovingly loyally madly meekly merrily mightily
  mildly monthly mostly neatly never nicely nightly nimbly nobly noisily
  oddly often openly politely poorly prettily promptly proudly quickly
  quietly rapidly rarely rashly readily regally richly roughly ruefully
  sadly safely secretly seldom serenely sharply shrewdly shrilly shyly
  silently simply sleepily sloppily slowly slyly smoothly smugly sneakily
  snugly softly sternly strictly strongly suddenly surely sweetly swiftly
  tenderly terribly tightly timidly truly usually utterly vaguely vastly
  vividly warmly weakly wearily weekly wholly widely wildly wisely wittily
  wryly yearly
`);

export const ENDINGS = list(`
  aboard abroad afar again ahead aloft aloud anew anywhere ashore away awry
  downhill downtown early forever forward here homeward indoors inland
  inside later leeward midway nearby now offshore offstage onstage onward
  outdoors outside outward overhead overseas seaward skyward soon there
  today together tomorrow tonight underway uphill upstairs upstate upstream
  uptown upward westward
`);

export const PREPOSITIONS = list(`
  above across after against along amid among around atop before behind
  below beneath beside between beyond despite during for from inside into
  like near off onto outside over past through toward under unlike upon with
  within without
`);
