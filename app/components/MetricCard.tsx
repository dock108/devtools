'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon, InfoIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: number;
  trendLabel?: string;
  tooltip?: string;
  footer?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  description,
  trend,
  trendLabel,
  tooltip,
  footer,
  loading = false,
  className,
}: MetricCardProps) {
  const trendIsPositive = trend !== undefined && trend > 0;
  const trendIsNegative = trend !== undefined && trend < 0;
  const trendAbsValue = trend !== undefined ? Math.abs(trend) : undefined;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-3.5 w-3.5 ml-1 inline-block text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && <CardDescription>{description}</CardDescription>}
        {trend !== undefined && !loading && (
          <div className="mt-2 flex items-center text-xs">
            {trendIsPositive && <ArrowUpIcon className="h-3.5 w-3.5 text-green-500 mr-1" />}
            {trendIsNegative && <ArrowDownIcon className="h-3.5 w-3.5 text-red-500 mr-1" />}
            <span
              className={cn(
                'font-medium',
                trendIsPositive && 'text-green-500',
                trendIsNegative && 'text-red-500',
              )}
            >
              {trendAbsValue}%
            </span>
            {trendLabel && <span className="ml-1 text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
      {footer && <CardFooter className="pt-0">{footer}</CardFooter>}
    </Card>
  );
}
