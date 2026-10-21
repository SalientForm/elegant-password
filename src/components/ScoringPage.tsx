import { LEVELS, levelRange, MAX_LEVEL, RUBRIC, RUBRICS, typingModeLabel, type Level } from '../lib/difficulty';
import { ATTACK_SCENARIOS, crackEstimates, formatDuration, STRENGTH_PRESETS } from '../lib/generate';
import { LONG_REACH } from '../lib/ease';
import { PROFILE_LABELS } from '../lib/modeProfiles';
import { MEMORABILITY, MEMORABILITY_BANDS, STRENGTH_BANDS } from '../lib/score';
import { largeNumber, numberWord, STRENGTH_WORDS } from '../lib/readings';
import { BUILT_IN_MAPPINGS } from '../lib/twists';
import { ZXCVBN_GUESSES_PER_SECOND, ZXCVBN_LABELS, ZXCVBN_LEVELS, ZXCVBN_URL, ZXCVBN_VERSION } from '../lib/zxcvbnReading';
import { COMMON_PASSWORD_COUNT } from '../lib/common';
import { COMMON_PASSWORDS_SOURCE } from '../lib/commonPasswords';
import { BITS_PER_ENGLISH_LETTER, CLASS_SIZES, KEY_WALK_CHOICES, MEMORABLE_DIGITS_CHOICES, MIN_KEY_WALK, SYMBOL_CHOICES } from '../lib/strength';
import { RubricTable } from './Difficulty';
import { ModeMeasuresTable, ModeOptionsTable } from './ModeOptionsTable';

/** How many criteria the modes use between them. */
const CRITERIA_COUNT = new Set(Object.values(RUBRICS).flatMap((r) => r.map((c) => c.id))).size;
/** The totals each difficulty level covers: "0–20 effortless, 21–40 easy, …". */
const LEVEL_TOTALS = LEVELS.map((label, level) => {
  const { min, max } = levelRange(level as Level);
  return `${min}–${max} ${label.toLowerCase()}`;
}).join(', ');

/** The Scoring page: how difficulty and strength are scored, in one place. */
export function ScoringPage() {
  return (
    <div className="scoring">
      <section className="panel">
        <h2>Strength, Raw and bits</h2>
        <p>
          Every password carries three strength figures, one for each level of attacker knowledge. Two are scores
          that travel with the password and are worked out from it alone, so a password reads the same wherever it
          appears; the third needs this session and stays in it.
        </p>
        <h3>Raw: the attacker knows nothing</h3>
        <p>
          Brute force over the characters used. The classes present make the alphabet (lower case {CLASS_SIZES.lower}, upper case{' '}
          {CLASS_SIZES.upper}, digits {CLASS_SIZES.digit}, symbols {CLASS_SIZES.symbol}, anything else about {CLASS_SIZES.other}), and each character is one pick from it. A character that
          repeats the one before it adds nothing, so <code>aaaaaaaaaaaa</code> is one <code>a</code>. It is the figure
          every naive strength meter gives, shown as the "Raw" badge, with no colour: it is for comparison, not for
          trust.
        </p>
        <h3>Strength: the attacker knows English and the usual habits, not this tool</h3>
        <p>
          The "Strength" badge. A run of letters is English-like text at {BITS_PER_ENGLISH_LETTER} bits a letter (never
          less than one letter's pick, a repeated letter counted once, one more bit when the run has a capital; a
          capital after a lower-case letter starts a new run). A run of digits is its digits at {Math.log2(CLASS_SIZES.digit).toFixed(1)} bits each, a
          memorable run like 123 or 2468 one pick of {MEMORABLE_DIGITS_CHOICES}. Each distinct symbol, the space among
          them, is one pick of {SYMBOL_CHOICES}, however often it appears: a separator typed three times is one choice.
          No word lists, no sentence patterns, no swap table and no hint go in, so a swap never changes a word's
          strength: <code>Rqmote</code> is six letters whether or not <code>e → q</code> is anyone's mapping.
        </p>
        <p>
          The usual habits are the ones attackers try first. A password that is exactly one of the{' '}
          <a href={COMMON_PASSWORDS_SOURCE} target="_blank" rel="noreferrer">
            {COMMON_PASSWORD_COUNT.toLocaleString('en')} most common passwords
          </a>{' '}
          (SecLists) is the guesses it takes to reach it on that list, log2 of its place: <code>password</code>, first on
          it, is 0 bits. Such a password is not allowed anywhere here: no suggestion is one, My list will not take one,
          and the typing test says so. Only an exact match counts, so <code>Dragon</code> is not <code>dragon</code>. A
          block typed again and again counts once, plus log2 of the times (<code>Password1!</code> three times is{' '}
          <code>Password1!</code> and 1.6 bits; two letters count only from three times, so <code>banana</code> stays a
          word). A walk of {MIN_KEY_WALK} letters or more along a keyboard row or the alphabet (<code>asdf</code>,{' '}
          <code>poiu</code>, <code>abcd</code>) is one pick of {KEY_WALK_CHOICES.toLocaleString('en')}. The badge
          is green from {STRENGTH_BANDS.green} bits, yellow from {STRENGTH_BANDS.yellow} and red below, judged on the figure
          as shown; its tip says {STRENGTH_WORDS.high}, {STRENGTH_WORDS.mid} or {STRENGTH_WORDS.low}. The presets below
          are targets for the bits, not Strength readings.
        </p>
        <h3>zxcvbn: a second opinion</h3>
        <p>
          Every password, on a card, in the typing test and in My list, also carries what the{' '}
          <a href={ZXCVBN_URL} target="_blank" rel="noreferrer">
            zxcvbn
          </a>{' '}
          library (Dropbox's password strength estimator, {ZXCVBN_VERSION}) says about it, run here in your browser. Its crack time
          for an offline attack on a slow hash ({largeNumber(ZXCVBN_GUESSES_PER_SECOND)} guesses a second) reads as one of {numberWord(ZXCVBN_LABELS.length)} words:{' '}
          {Object.entries(ZXCVBN_LEVELS).map(([word, time]) => `${word} (${time})`).join(', ')}. It is the fourth badge,
          "zxcvbn strong". On a card or in the typing test it is worked out as the password appears; for My list it is
          worked out once, when the password is added, and saved with it. It is not one of this app's scores and sorts
          nothing.
        </p>
        <h3>Bits: the attacker knows this tool exactly</h3>
        <p>
          Entropy: log2 of the number of passwords the generator could have produced in exactly the same way, assuming
          the attacker knows this tool, its word lists, the sentence patterns, every rule and the swaps switched on in
          this session, so only the random choices count. Which words were drawn, where the number went, which
          spellings the swaps chose: those add bits. Fixed rules add nothing: capitalising the first letter, the
          separator, which words become initials, and the deliberate swaps that ease awkward words. The closing symbol
          is drawn at random for each password, for variety, but counts nothing either. 40 bits means about a
          trillion equally likely passwords.
        </p>
        <p>
          Before a sentence is drawn, every way to fill the chosen sentence pattern within the length limits is counted
          by dynamic programming, and the password is then drawn uniformly from exactly that set. The bits panel under
          the suggestions shows this figure, the pool each slot was drawn from, and what the length limits cost. Each
          card also shows its own bits figure, dim beside the badges: the hint's words found in the password (whole,
          shortened, as an initial, or swapped), matched to a sentence pattern and counted at the most restrictive
          typing-comfort level that contains them, plus the number of distinct ways the swaps found could have landed,
          over the swaps in force (one custom swap makes the count run over {BUILT_IN_MAPPINGS.length + 1} mappings, not {BUILT_IN_MAPPINGS.length}). It does not know the
          length limits, so it can sit above the plan's figure. It needs the session, so it is never saved with a
          password: My list and the typing test show the badges only.
        </p>
        <h3>Deliberate swaps</h3>
        <p>
          With "Ease awkward words" on, a word with a same-finger jump (like e-d) or a long reach ({numberWord(LONG_REACH)} key widths or
          more, like w-i) is typed with one fixed misspelling that removes it: “wise” becomes wyse, “cool” cul. The
          swap is a fixed function of the word, so the bits count it as zero, never as a random swap; random swaps on
          top are counted from the swapped spelling. The easier typing shows in the difficulty score. It is not one
          more thing to remember: it comes with its word by one fixed rule, so it adds nothing to memory load and costs
          no memorability, and the swapped word counts as kept whole.
        </p>
        <h3>A hint only ever lowers the bits</h3>
        <p>
          Someone who has your hint but not your password is only helped by it. So the bits with a hint are never
          above the bits of the password on its own, read off the password's own runs of letters and digits (a run that
          is a swapped spelling of one of this tool's words is read back to that word through the mapping table). A
          hint word that is not in the password adds nothing, letters and digits the hint does not account for are
          counted as text, and when the hint reveals what the text alone cannot show (a shortened word, say), the text
          reading is the ceiling.
        </p>
        <h3>Choosing a favourite</h3>
        <p>
          Seeing several suggestions, or pressing Refresh until you like one, leans your choice toward what you
          find likeable. The figures do not discount for that. Take the first one you can live with.
        </p>
        <h3>Time to guess</h3>
        <p className="hint">Average time to find the password at the bits of each target, half the space, at {numberWord(ATTACK_SCENARIOS.length)} attacker speeds; for an attacker who knows the tool.</p>
        <div className="table-scroll">
          <table className="rubric stack">
            <thead>
              <tr>
                <th>Target</th>
                {ATTACK_SCENARIOS.map((a) => (
                  <th key={a.scenario}>{a.scenario}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STRENGTH_PRESETS.map((p) => (
                <tr key={p.bits}>
                  <td data-label="Target">
                    <strong>
                      {p.label}, {p.bits} bits
                    </strong>
                    <small>{p.hint}</small>
                  </td>
                  {crackEstimates(p.bits).map((e) => (
                    <td key={e.scenario} data-label={e.scenario}>
                      {formatDuration(e.seconds)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Difficulty, 0 to 100</h2>
        <p>
          How hard a password is to type and to carry in your head. {CRITERIA_COUNT} criteria in all, up to {RUBRIC.length} in one mode, each measured on the password alone,
          each landing on a level from {LEVELS[0]} (0) to {LEVELS[MAX_LEVEL]} ({MAX_LEVEL}) by fixed cut-points. A criterion earns weight × level
          ÷ {MAX_LEVEL} points; the weights add up to 100. Totals: {LEVEL_TOTALS}. Each card shows its own table; this is the whole rubric.
        </p>
        <p>
          The rubric depends on how the password will be typed, chosen under Mode in the Presets card on the Passwords page: with ten
          fingers on the home row (the standard), with two fingers hunting for keys, with one hand,
          or as quickly as possible. Each mode weighs the criteria differently, drops the ones that no longer apply and
          has its own typing-time model, so the same password can score differently in each. The mode itself changes
          only the difficulty score; the passwords change through the options it fills in, below.
        </p>
        <RubricTable />
        <h3>Options by mode</h3>
        <p>
          Picking a mode fills in the strength, comfort and style options that suit it, in the Requirement options, as a
          draft: Submit applies them and draws a new sentence, Discard puts them back. The site's rules, the number of
          suggestions and the swap mappings are never touched, and any option can still be changed by hand afterwards.
          Two options exist for the modes: "{PROFILE_LABELS.shortest}" gives {typingModeLabel('quick')} the shortest sentence the
          site's rules allow, and "{PROFILE_LABELS.shiftReach}" keeps every {typingModeLabel('one-handed')} Shift stroke within reach of the
          hand holding Shift. Strength and memorability never depend on the mode: they are scored from the password
          and its hint alone.
        </p>
        <ModeOptionsTable />
        <h3>Measured</h3>
        <ModeMeasuresTable />
      </section>

      <section className="panel">
        <h2>Memorability, 0 to 100</h2>
        <p>
          How closely the password still looks like the sentence it came from, scored from the password and its hint
          alone. Each hint word is found in the password and given a size credit: 1 when it kept its full length (a
          swapped spelling of the same length still counts in full, and so does a word typed with its deliberate swap,
          like “cool” as cul), the fraction kept when it was shortened (a capital initial for a six-letter word keeps
          one sixth), 0 when it was dropped. A word is found by the app's fixed shortening rules and swap table, and
          failing those by its letters: a spelling within a few edits is the word, each edit one step away, so a word
          reached through a swap of your own is not a dropped word. Nothing about the session goes in. The mean of those credits is fidelity,
          worth {MEMORABILITY.fidelityWeight * 100}% of the score. Brevity is worth the other{' '}
          {MEMORABILITY.brevityWeight * 100}%: 1 at {MEMORABILITY.shortAt} characters or fewer, falling to 0 at{' '}
          {MEMORABILITY.longAt} or more. Each word with a random swap then costs {MEMORABILITY.swapPenalty} points, up to{' '}
          {MEMORABILITY.maxSwapPenalty}; a deliberate swap costs nothing. The badge is green above {MEMORABILITY_BANDS.green}, yellow above{' '}
          {MEMORABILITY_BANDS.yellow}, and red at {MEMORABILITY_BANDS.yellow} or below.
        </p>
      </section>
    </div>
  );
}
