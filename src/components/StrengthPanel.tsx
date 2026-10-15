import { crackEstimates, formatDuration, type Plan } from '../lib/generate';

export function StrengthPanel({ plan, count, target }: { plan: Plan; count: number; target: number }) {
  const pickPenalty = count > 1 ? Math.log2(count) : 0;
  const effective = plan.bits - pickPenalty;
  const counted = plan.breakdown.filter((b) => b.poolSize > 1);

  return (
    <section className="panel strength">
      <div className="strength-head">
        <div>
          <h2>Why it is strong</h2>
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
        Capitalisation, separators and the closing symbol follow fixed rules, so they add nothing here. Twists add
        more on top; the amount depends on the words, so each card shows its own total and these figures are the
        floor.
        {pickPenalty > 0 &&
          ` If you pick your favourite of these ${count}, count it as about ${effective.toFixed(1)} bits (choosing costs ${pickPenalty.toFixed(1)}).`}
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
