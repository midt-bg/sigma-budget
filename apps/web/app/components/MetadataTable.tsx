import type { ReactNode } from 'react';
import { num } from '../lib/legacy';
export interface Column<R> {
  key: keyof R;
  label: string;
  align?: string;
  fmt?(value: R[keyof R], row: R): ReactNode;
}
export function dataTable<R extends object>(o: {
  id: string;
  caption: string;
  columns: Column<R>[];
  rows: R[];
  dense?: boolean;
  captionVisible?: boolean;
}) {
  const aligns = o.columns.map(
    (c) => c.align || (o.rows.some((r) => typeof r[c.key] === 'number') ? 'end' : 'start'),
  );
  const cell = (c: Column<R>, r: R): ReactNode => {
    const v = r[c.key];
    if (c.fmt) return c.fmt(v, r);
    if (v == null)
      return (
        <span className="muted" title="Няма данни">
          —
        </span>
      );
    return typeof v === 'number' ? num(v, Number.isInteger(v) ? 0 : 1) : String(v);
  };
  return (
    <div
      className={`table-wrap${o.dense ? ' dense' : ''}`}
      id={`${o.id}-wrap`}
      tabIndex={0}
      role="region"
      aria-labelledby={`${o.id}-cap`}
      data-ui="table"
      data-attach={o.id}
    >
      <table className="data" id={o.id}>
        <caption id={`${o.id}-cap`} className={o.captionVisible ? 'cap-visible' : 'sr-only'}>
          {o.caption}
        </caption>
        <thead>
          <tr>
            {o.columns.map((c, i) => (
              <th key={String(c.key)} scope="col" className={aligns[i] === 'end' ? 't-end' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {o.rows.length ? (
            o.rows.map((r, i) => (
              <tr key={i}>
                {o.columns.map((c, j) =>
                  j === 0 ? (
                    <th
                      key={String(c.key)}
                      scope="row"
                      className={aligns[j] === 'end' ? 't-end' : undefined}
                    >
                      {cell(c, r)}
                    </th>
                  ) : (
                    <td key={String(c.key)} className={aligns[j] === 'end' ? 't-end' : undefined}>
                      {cell(c, r)}
                    </td>
                  ),
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={o.columns.length} className="t-empty">
                Няма редове за показване.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
