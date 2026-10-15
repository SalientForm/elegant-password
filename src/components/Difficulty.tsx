import { criterionOf, LEVELS, RUBRIC, type Criterion, type Difficulty } from '../lib/difficulty';

/** One password scored against each rubric criterion. */
export function DifficultyTable({ difficulty }: { difficulty: Difficulty }) {
  return (
    <table className="rubric stack">
      <thead>
        <tr>
          <th>Criterion</th>
          <th>Measured</th>
          <th>Level</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {difficulty.criteria.map(({ id, value, level, points }) => {
          const criterion = criterionOf(id);
          return (
          <tr key={criterion.id} title={criterion.measures}>
            <td data-label="Criterion">{criterion.name}</td>
            <td data-label="Measured">{criterion.format(value)}</td>
            <td data-label="Level">
              <span className={`pip level-${level}`}>{LEVELS[level]}</span>
            </td>
            <td data-label="Points">
              {points % 1 ? points.toFixed(1) : points} / {criterion.weight}
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const band = (c: Criterion, level: number) => {
  const lo = level === 0 ? undefined : c.cutPoints[level - 1];
  const hi = level === 4 ? undefined : c.cutPoints[level];
  if (lo === undefined) return `< ${c.format(hi!)}`;
  if (hi === undefined) return `≥ ${c.format(lo)}`;
  return `${c.format(lo)}–${c.format(hi)}`;
};

/** The whole rubric: what each criterion measures and where its levels start. */
export function RubricTable() {
  return (
    <>
      <div className="table-scroll">
        <table className="rubric stack">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Weight</th>
              {LEVELS.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RUBRIC.map((c) => (
              <tr key={c.id}>
                <td data-label="Criterion">
                  <strong>{c.name}</strong>
                  <small>{c.measures}</small>
                </td>
                <td data-label="Weight">{c.weight}</td>
                {LEVELS.map((l, level) => (
                  <td key={level} data-label={l}>
                    {band(c, level)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
