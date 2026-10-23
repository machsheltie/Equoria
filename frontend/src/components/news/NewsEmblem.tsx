/**
 * NewsEmblem — the engraved-line emblems of the News page (Equoria-wbt8l).
 *
 * Authored for the Night Road (the owner-chosen Option B), not a generic icon
 * set: one 1.5px stroke weight, round joins, drawn on a 24px grid, coloured by
 * `currentColor`. Always decorative — the words beside them carry the meaning.
 */

import type { SVGProps } from 'react';

export type NewsEmblemName =
  | 'moon'
  | 'lantern'
  | 'pennant'
  | 'rosette'
  | 'saddle'
  | 'star'
  | 'shoe'
  | 'scroll'
  | 'chevron'
  | 'alert';

const PATHS: Record<NewsEmblemName, string[]> = {
  moon: ['M15.5 3.2A8.8 8.8 0 1 0 20.8 16 7.3 7.3 0 0 1 15.5 3.2Z', 'M19 4.5v3M17.5 6h3'],
  lantern: [
    'M12 1.8v2.4',
    'M8.5 6.2h7l-1-2h-5l-1 2Z',
    'M8 6.2c-.8 2.5-.8 9 0 11.6h8c.8-2.6.8-9.1 0-11.6',
    'M7.4 19.8h9.2',
    'M12 10.2c1.4 1.4 1.4 3.4 0 4.6-1.4-1.2-1.4-3.2 0-4.6Z',
    'M8 17.8l.6 2M16 17.8l-.6 2',
  ],
  pennant: ['M5 2.5v19', 'M5 4h14l-4 4.5 4 4.5H5'],
  rosette: [
    'M12 2.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 1 0 0-12.4Z',
    'M12 6a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z',
    'M8.6 14.2 6.8 21.5l3-1.7 1.2 2.4 1-6.8M15.4 14.2l1.8 7.3-3-1.7-1.2 2.4',
  ],
  saddle: [
    'M2.5 11.5c2.2 0 3-2.8 4.6-3.6 2.4-1.2 4.4 2.4 7 2.4 2 0 3.6-2.4 5.4-2.4 1 0 2 .8 2 1.8',
    'M4.5 11.8c1.5 2.6 4.6 3.6 8 3.6s6.4-1.3 8.2-4.4',
    'M11.8 15.4v3.4',
    'M9.8 18.8h4.2l-.6 2.2h-3l-.6-2.2Z',
  ],
  star: ['M12 2.5l1.9 7.6 7.6 1.9-7.6 1.9L12 21.5l-1.9-7.6L2.5 12l7.6-1.9L12 2.5Z'],
  shoe: [
    'M6.5 20.5C3.8 17.4 3 13.4 4 9.7 5.1 5.7 8.3 3 12 3s6.9 2.7 8 6.7c1 3.7.2 7.7-2.5 10.8',
    'M9.3 20.5c-1.9-2.4-2.5-5.3-1.8-8 .7-2.7 2.5-4.6 4.5-4.6s3.8 1.9 4.5 4.6c.7 2.7.1 5.6-1.8 8',
    'M5 20.5h4.3M14.7 20.5H19',
  ],
  scroll: [
    'M6 4.5h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8',
    'M6 4.5a2 2 0 0 0-2 2v1.5h4V6.5a2 2 0 0 0-2-2Z',
    'M8 8v10.5a2 2 0 0 1-2 2',
    'M11 9h5M11 12.5h5M11 16h3',
  ],
  chevron: ['m9 6 6 6-6 6'],
  alert: ['M12 3.5 21.5 20h-19L12 3.5Z', 'M12 10v4.5M12 17.2v.1'],
};

interface NewsEmblemProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: NewsEmblemName;
}

export function NewsEmblem({ name, className, ...rest }: NewsEmblemProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `news-emblem ${className}` : 'news-emblem'}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
