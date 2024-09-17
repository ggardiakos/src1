// src/modules/shopify/decorators/measure.decorator.ts

import { Logger } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * Measure decorator to track the execution time of methods.
 * The execution time is recorded and logged using the metrics service.
 *
 * @param metricName - The name of the metric to be tracked.
 */
export function Measure(metricName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`${target.constructor.name}`);
    const metricsService = new MetricsService(); // Ideally, this should be injected via DI

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        // Execute the original method
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        // Measure and log the duration
        const duration = Date.now() - start;
        logger.debug(`${propertyKey} took ${duration}ms`);
        metricsService.recordMethodDuration(metricName, duration);
      }
    };

    return descriptor;
  };
}
