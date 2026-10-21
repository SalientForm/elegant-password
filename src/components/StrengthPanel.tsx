import { memo } from 'react';
import { crackEstimates, formatDuration, type Plan } from '../lib/generate';

/**
 * The bits: the exact entropy of the current plan, for an attacker who knows
 * this tool. This is the generator's figure for these settings and this
 * session; it is never saved with a password. The badges on the cards
 * (Strength, Raw) assume an attacker who does not know the tool, and travel
 * with the password.
 */
export const StrengthPanel = memo(function StrengthPanel({ plan, target }: { plan: Plan; target: number }) {
  const counted = plan.breakdown.filter((b) => b.poolSize > 1);

  return (
    <section className="panel strength">
      <div className="strength-head">
        <div>
          <h2>Bits: for an attacker who knows this tool</h2>
          <p className="hint">
            The exact entropy of the random choices behind this batch, assuming the attacker knows this tool, its
            word lists and the sentence pattern. The Strength and Raw badges on the cards assume an attacker who does
            not know the tool; this figure is for one who does, and it stays in this session.
          </p>
        </div>
        <div className={plan.meetsTarget ? 'bits ok' : 'bits low'}>
          <strong>{plan.bits.toFixed(1)}</strong>
          <span>bits (target {target})</span>
        </div>
      </div>

      <table className="stack">
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
              <td data-label="Word">{b.label}</td>
              <td data-label="Chosen from">{b.poolSize.toLocaleString('en')} options</td>
              <td data-label="Adds">{b.bits.toFixed(1)} bits</td>
            </tr>
          ))}
          {plan.lengthPenaltyBits > 0.05 && (
            <tr className="minus">
              <td data-label="Word">{plan.shortest ? 'Shortest sentence' : 'Length limits'}</td>
              <td data-label="Chosen from">{plan.shortest ? `keeps only the sentences of up to ${plan.maxLength} characters` : 'rule out some combinations'}</td>
              <td data-label="Adds">−{plan.lengthPenaltyBits.toFixed(1)} bits</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="hint">
        Capitalisation and separators{plan.easeSwaps ? ' and the deliberate swaps that ease awkward words' : ''} follow
        fixed rules, and the closing symbol, though drawn at random for variety, is not counted, so they add nothing
        here. Random swaps add more on top. The bits figure beside each card's badges is counted from that password
        and its hint with the swaps in force in this session; it does not know the length limits, so it can sit above
        this one, by more when Shortest is on.
      </p>
      <p className="hint">
        Choosing a favourite is a bias the figures here do not discount: seeing several suggestions, or pressing Refresh
        until you like one, leans your choice toward what you find likeable. Take the first one you can live
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
      <p className="hint">Average time to guess, for an attacker who knows the tool, at 10, 100,000 and 100 billion guesses per second.</p>
    </section>
  );
});
