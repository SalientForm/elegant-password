import { ATTACK_SCENARIOS, crackEstimates, formatDuration, STRENGTH_PRESETS } from '../lib/generate';
import { MEMORABILITY } from '../lib/score';
import { RubricTable } from './Difficulty';

/** The Scoring page: how difficulty and strength are scored, in one place. */
export function ScoringPage() {
  return (
    <div className="scoring">
      <section className="panel">
        <h2>Strength, in bits</h2>
        <p>
          Strength is entropy: log2 of the number of passwords the generator could have produced in exactly the same
          way. The maths assumes the attacker knows this tool, its word lists, the sentence patterns and every rule, so
          only the random choices count. Which words were drawn, where the number went, which spellings the swaps
          chose: those add bits. Fixed rules add nothing: capitalising the first letter, the separator, which words
          become initials, and the deliberate swaps that ease awkward words. The closing symbol is drawn at random
          for each password, for variety, but counts nothing either. 40 bits means about a trillion equally likely passwords. The "S" badge on
          each card is green from the Strong preset at 50 bits, yellow from Everyday at 40, and red below.
        </p>
        <h3>The plan: exact</h3>
        <p>
          Before a sentence is drawn, every way to fill the chosen sentence pattern within the length limits is counted
          by dynamic programming, and the password is then drawn uniformly from exactly that set. The strength panel
          under the suggestions shows this figure, the pool each slot was drawn from, and what the length limits cost.
        </p>
        <h3>A password: scored cold</h3>
        <p>
          Each card and each entry in your list scores its password from two strings only: the password and its hint.
          The hint's words are found in the password (whole, shortened, as an initial, or swapped), matched to a
          sentence pattern, and counted at the most restrictive typing-comfort level that contains them; the swaps
          found are counted as the number of distinct ways they could have landed. Nothing else goes in, not the
          settings, not how many suggestions you saw, so a password scores the same wherever and whenever it appears.
          The cold figure does not know the length limits, so it can sit a little above the plan's exact figure.
        </p>
        <h3>Deliberate swaps</h3>
        <p>
          With "Ease awkward words" on, a word with a same-finger jump (like e-d) or a long reach (six key widths or
          more, like w-i) is typed with one fixed misspelling that removes it: “wise” becomes wyse, “cool” cul. The
          swap is a fixed function of the word, so the scorer works it out from the hint and counts it as zero bits,
          never as a random swap; random swaps on top are counted from the swapped spelling. The easier typing shows
          in the difficulty score. It is not one more thing to remember: it comes with its word by one fixed rule, so
          it adds nothing to memory load and costs no memorability, and the swapped word counts as kept whole. Comfort
          then ranks words as typed; since a password cannot say for sure which ranking made it, the scorer tries both
          and keeps the lower figure.
        </p>
        <h3>Words that are not on the lists</h3>
        <p>
          The same rule scores every password, whatever it came from; nothing about its origin goes in. A hint word on
          this tool's lists counts as one pick from the smallest list holding it. Any other word counts as English-like
          text at 2.3 bits per letter, a capital initial of it as one letter, a number as its digits (a memorable run
          like 123 as a single pick), a dropped word as nothing; the swaps found are counted exactly, as above. This is
          an estimate of the text, not of how guessable your sentence is to someone who knows you: a private, slightly
          odd sentence of five or more words is good; quotes, lyrics and facts about you are weak because attackers try
          them first.
        </p>
        <h3>Choosing a favourite</h3>
        <p>
          Seeing several suggestions, or pressing Refresh until you like one, leans your choice toward what you
          find likeable. The figures do not discount for that. Take the first one you can live with.
        </p>
        <h3>Time to guess</h3>
        <p className="hint">Average time to find the password, half the space, at three attacker speeds.</p>
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
          How hard a password is to type and to carry in your head. Up to nine criteria, each measured on the password alone,
          each landing on a level from Effortless (0) to Hard (4) by fixed cut-points. A criterion earns weight × level
          ÷ 4 points; the weights add up to 100. Totals: 0–20 effortless, 21–40 easy, 41–60 moderate, 61–80 demanding,
          81–100 hard. Each card shows its own table; this is the whole rubric.
        </p>
        <p>
          The rubric depends on how the password will be typed, chosen in the Mode card on the Passwords page: with ten
          fingers on the home row (the standard), with two fingers hunting for keys, with one hand,
          or as quickly as possible. Each mode weighs the criteria differently, drops the ones that no longer apply and
          has its own typing-time model, so the same password can score differently in each. The mode changes only the
          difficulty: the passwords, their strength and memorability stay the same.
        </p>
        <RubricTable />
      </section>

      <section className="panel">
        <h2>Memorability, 0 to 100</h2>
        <p>
          How closely the password still looks like the sentence it came from, scored from the password and its hint
          alone. Each hint word is found in the password and given a size credit: 1 when it kept its full length (a
          swapped spelling of the same length still counts in full, and so does a word typed with its deliberate swap,
          like “cool” as cul), the fraction kept when it was shortened (a capital initial for a six-letter word keeps
          one sixth), 0 when it was dropped. The mean of those credits is fidelity,
          worth {MEMORABILITY.fidelityWeight * 100}% of the score. Brevity is worth the other{' '}
          {MEMORABILITY.brevityWeight * 100}%: 1 at {MEMORABILITY.shortAt} characters or fewer, falling to 0 at{' '}
          {MEMORABILITY.longAt} or more. Each word with a random swap then costs {MEMORABILITY.swapPenalty} points, up to{' '}
          {MEMORABILITY.maxSwapPenalty}; a deliberate swap costs nothing. The badge is green above 75, yellow above 45, and red at 45 or below.
        </p>
      </section>
    </div>
  );
}
