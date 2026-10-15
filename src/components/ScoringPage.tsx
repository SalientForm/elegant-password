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
          chose: those add bits. Fixed rules add nothing: capitalising the first letter, the separator, the closing
          marks, which words become initials. 40 bits means about a trillion equally likely passwords. The "S" badge on
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
        <h3>Your own sentence</h3>
        <p>
          How guessable a sentence is cannot be measured here. For a sentence you typed, only the random parts count:
          which words became initials and where the swaps landed. A private, slightly odd sentence of five or more
          words is good; quotes, lyrics and facts about you are weak because attackers try them first.
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
          How hard a password is to type and to carry in your head. Nine criteria, each measured on the password alone,
          each landing on a level from Effortless (0) to Hard (4) by fixed cut-points. A criterion earns weight × level
          ÷ 4 points; the weights add up to 100. Totals: 0–20 effortless, 21–40 easy, 41–60 moderate, 61–80 demanding,
          81–100 hard. Each card shows its own table; this is the whole rubric.
        </p>
        <RubricTable />
      </section>

      <section className="panel">
        <h2>Memorability, 0 to 100</h2>
        <p>
          How closely the password still looks like the sentence it came from, scored from the password and its hint
          alone. Each hint word is found in the password and given a size credit: 1 when it kept its full length (a
          swapped spelling of the same length still counts in full), the fraction kept when it was shortened (a capital
          initial for a six-letter word keeps one sixth), 0 when it was dropped. The mean of those credits is fidelity,
          worth {MEMORABILITY.fidelityWeight * 100}% of the score. Brevity is worth the other{' '}
          {MEMORABILITY.brevityWeight * 100}%: 1 at {MEMORABILITY.shortAt} characters or fewer, falling to 0 at{' '}
          {MEMORABILITY.longAt} or more. Each swapped word then costs {MEMORABILITY.swapPenalty} points, up to{' '}
          {MEMORABILITY.maxSwapPenalty}. The badge is green above 75, yellow above 45, and red at 45 or below.
        </p>
      </section>
    </div>
  );
}
