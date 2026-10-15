import { crackEstimates, formatDuration, type Plan } from '../lib/generate';

/**
 * Why a generated password is strong: the exact entropy of the current plan.
 * This is the generator's figure for these settings. Each card's figure is
 * scored from its own password and hint alone (see src/lib/score.ts), so it
 * can differ a little; the card is what travels with the password.
 */
export function StrengthPanel({ plan, target }: { plan: Plan; target: number }) {
  const counted = plan.breakdown.filter((b) => b.poolSize > 1);

  return (
    <section className="panel strength">
      <div className="strength-head">
        <div>
          <h2>Why this sentence is strong</h2>
          <p className="hint">
            The maths assumes an attacker knows this tool, its word lists and the sentence pattern. Strength comes only
            from the random choices.
          </p>
        </div>
        <div className={plan.meetsTarget ? 'bits ok' : 'bits low'}>
          <strong>{plan.bits.toFixed(1)}</strong>
          <span>bits (target {target})</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Word</th>
            <th>Chosen from</th>
            <th>Adds</th>
          </tr>
        </thead>
        <tbody>
          {counted.map((b, i) => (
            <tr key={i}>
              <td>{b.label}</td>
              <td>{b.poolSize.toLocaleString('en')} options</td>
              <td>{b.bits.toFixed(1)} bits</td>
            </tr>
          ))}
          {plan.lengthPenaltyBits > 0.05 && (
            <tr className="minus">
              <td>Length limits</td>
              <td>rule out some combinations</td>
              <td>−{plan.lengthPenaltyBits.toFixed(1)} bits</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="hint">
        Capitalisation, separators and the closing symbol follow fixed rules, so they add nothing here. Swaps add more
        on top. Each card scores its own password from the password and its hint alone, so a password reads the same
        wherever it appears; that figure does not know about the length limits, so it can sit a little above this one.
      </p>
      <p className="hint">
        Choosing a favourite is a bias the figures here do not discount: seeing several suggestions, or pressing New
        passwords until you like one, leans your choice toward what you find likeable. Take the first one you can live
        with rather than the one you love.
      </p>

      <dl className="crack">
        {crackEstimates(plan.bits).map((e) => (
          <div key={e.scenario}>
            <dt>{e.scenario}</dt>
            <dd>{formatDuration(e.seconds)}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">Average time to guess, at 10, 100,000 and 100 billion guesses per second.</p>
    </section>
  );
}
