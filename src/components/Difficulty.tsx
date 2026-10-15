import { criterionOf, LEVELS, RUBRIC, type Criterion, type Difficulty } from '../lib/difficulty';

/** One password scored against each rubric criterion. */
export function DifficultyTable({ difficulty }: { difficulty: Difficulty }) {
  return (
    <table className="rubric">
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
            <td>{criterion.name}</td>
            <td>{criterion.format(value)}</td>
            <td>
              <span className={`pip level-${level}`}>{LEVELS[level]}</span>
            </td>
            <td>
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
        <table className="rubric">
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
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.measures}</small>
                </td>
                <td>{c.weight}</td>
                {LEVELS.map((_, level) => (
                  <td key={level}>{band(c, level)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
