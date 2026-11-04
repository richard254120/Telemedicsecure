/**
 * Charts are the single heaviest dependency in this console (recharts plus its
 * d3 transitive graph) and only two of the seven panels use one. The
 * implementation therefore lives behind a dynamic import so it is fetched with
 * the panel that needs it instead of in the initial bundle.
 */
import React, { lazy, Suspense } from 'react';
import { Skeleton } from './ui';

const ChartImpl = lazy(() => import('./ChartImpl'));

export interface ChartDatum {
  name: string;
  value: number;
  color?: string;
}

export interface ChartBlockProps {
  variant: 'donut' | 'bar';
  data: ChartDatum[];
  height?: number;
  emptyLabel?: string;
}

const ChartBlock: React.FC<ChartBlockProps> = ({ variant, data, height = 260, emptyLabel }) => (
  <Suspense fallback={<Skeleton style={{ height }} className="w-full" />}>
    <ChartImpl variant={variant} data={data} height={height} emptyLabel={emptyLabel} />
  </Suspense>
);

export default React.memo(ChartBlock);
