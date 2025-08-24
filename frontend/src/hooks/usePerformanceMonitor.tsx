import { useEffect, useRef, useState, useCallback } from "react";

interface PerformanceMetrics {
  renderCount: number;
  renderTimes: number[];
  slowRenders: number;
  memoryUsage?: MemoryInfo;
  componentName?: string;
  lastRenderTime: number;
  averageRenderTime: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Hook for monitoring React component performance
 * Tracks render times, memory usage, and identifies performance bottlenecks
 */
export function usePerformanceMonitor(componentName: string = "Unknown") {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    renderTimes: [],
    slowRenders: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    componentName,
  });

  const renderStartTime = useRef<number>(0);
  const isFirstRender = useRef(true);

  // Start measuring render time
  const startRenderMeasurement = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // End measuring render time and update metrics
  const endRenderMeasurement = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;

    setMetrics((prevMetrics) => {
      const newRenderTimes = [...prevMetrics.renderTimes, renderTime].slice(
        -100,
      ); // Keep last 100 renders
      const newRenderCount = prevMetrics.renderCount + 1;
      const newSlowRenders =
        renderTime > 16 ? prevMetrics.slowRenders + 1 : prevMetrics.slowRenders;
      const averageRenderTime =
        newRenderTimes.reduce((a, b) => a + b, 0) / newRenderTimes.length;

      return {
        ...prevMetrics,
        renderCount: newRenderCount,
        renderTimes: newRenderTimes,
        slowRenders: newSlowRenders,
        lastRenderTime: renderTime,
        averageRenderTime,
        memoryUsage: (performance as any).memory,
      };
    });

    // Log slow renders
    if (renderTime > 16) {
      console.warn(
        `🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
      );
    }

    // Log very slow renders
    if (renderTime > 100) {
      console.error(
        `🚨 Very slow render in ${componentName}: ${renderTime.toFixed(2)}ms`,
      );
    }
  }, [componentName]);

  // Measure memory usage
  const measureMemory = useCallback(() => {
    if ((performance as any).memory) {
      const memoryInfo = (performance as any).memory;
      setMetrics((prev) => ({
        ...prev,
        memoryUsage: {
          usedJSHeapSize: memoryInfo.usedJSHeapSize,
          totalJSHeapSize: memoryInfo.totalJSHeapSize,
          jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
        },
      }));
    }
  }, []);

  // Log performance summary
  const logPerformanceSummary = useCallback(() => {
    console.group(`📊 Performance Summary: ${componentName}`);
    console.log(`Renders: ${metrics.renderCount}`);
    console.log(
      `Average render time: ${metrics.averageRenderTime.toFixed(2)}ms`,
    );
    console.log(`Slow renders (>16ms): ${metrics.slowRenders}`);
    console.log(`Last render: ${metrics.lastRenderTime.toFixed(2)}ms`);

    if (metrics.memoryUsage) {
      const usagePercent =
        (metrics.memoryUsage.usedJSHeapSize /
          metrics.memoryUsage.jsHeapSizeLimit) *
        100;
      console.log(
        `Memory usage: ${usagePercent.toFixed(1)}% (${(metrics.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB)`,
      );
    }

    if (metrics.slowRenders > 0) {
      console.warn(
        `⚠️ Component has ${metrics.slowRenders} slow renders - consider optimization`,
      );
    }
    console.groupEnd();
  }, [componentName, metrics]);

  // Track render timing
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      startRenderMeasurement();
      return;
    }

    startRenderMeasurement();
  });

  useEffect(() => {
    endRenderMeasurement();
    measureMemory();
  });

  // Set up periodic performance logging
  useEffect(() => {
    const interval = setInterval(() => {
      if (metrics.renderCount > 0) {
        logPerformanceSummary();
      }
    }, 60000); // Log every minute

    return () => clearInterval(interval);
  }, [logPerformanceSummary, metrics.renderCount]);

  return {
    metrics,
    logPerformanceSummary,
    measureMemory,
  };
}

/**
 * Higher-order component for monitoring component performance
 */
export function withPerformanceMonitoring<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  componentName?: string,
) {
  const MonitoredComponent = (props: T) => {
    const displayName =
      componentName ||
      WrappedComponent.displayName ||
      WrappedComponent.name ||
      "Component";
    const { metrics } = usePerformanceMonitor(displayName);

    // Add performance data to dev tools
    useEffect(() => {
      if (process.env.NODE_ENV === "development") {
        (window as any).__REACT_PERFORMANCE_MONITOR__ = {
          ...(window as any).__REACT_PERFORMANCE_MONITOR__,
          [displayName]: metrics,
        };
      }
    }, [displayName, metrics]);

    return <WrappedComponent {...props} />;
  };

  MonitoredComponent.displayName = `withPerformanceMonitoring(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;

  return MonitoredComponent;
}

/**
 * Hook for monitoring network requests performance
 */
export function useNetworkMonitor() {
  const [networkMetrics, setNetworkMetrics] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    responseTimes: [] as number[],
  });

  const trackRequest = useCallback(
    async (requestPromise: Promise<any>, requestName?: string) => {
      const startTime = performance.now();

      try {
        const result = await requestPromise;
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        setNetworkMetrics((prev) => {
          const newResponseTimes = [...prev.responseTimes, responseTime].slice(
            -50,
          ); // Keep last 50 requests
          const newAverageResponseTime =
            newResponseTimes.reduce((a, b) => a + b, 0) /
            newResponseTimes.length;

          return {
            totalRequests: prev.totalRequests + 1,
            successfulRequests: prev.successfulRequests + 1,
            failedRequests: prev.failedRequests,
            averageResponseTime: newAverageResponseTime,
            responseTimes: newResponseTimes,
          };
        });

        if (responseTime > 1000) {
          console.warn(
            `🐌 Slow network request${requestName ? ` (${requestName})` : ""}: ${responseTime.toFixed(2)}ms`,
          );
        }

        return result;
      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        setNetworkMetrics((prev) => ({
          ...prev,
          totalRequests: prev.totalRequests + 1,
          failedRequests: prev.failedRequests + 1,
        }));

        console.error(
          `❌ Network request failed${requestName ? ` (${requestName})` : ""}: ${responseTime.toFixed(2)}ms`,
          error,
        );
        throw error;
      }
    },
    [],
  );

  return {
    networkMetrics,
    trackRequest,
  };
}

/**
 * Hook for detecting potential memory leaks
 */
export function useMemoryLeakDetector() {
  const memorySnapshots = useRef<number[]>([]);

  const takeMemorySnapshot = useCallback(() => {
    if ((performance as any).memory) {
      const usage = (performance as any).memory.usedJSHeapSize;
      memorySnapshots.current.push(usage);

      // Keep only last 20 snapshots
      if (memorySnapshots.current.length > 20) {
        memorySnapshots.current = memorySnapshots.current.slice(-20);
      }

      // Check for memory leak (consistent increase over time)
      if (memorySnapshots.current.length >= 10) {
        const recent = memorySnapshots.current.slice(-10);
        const trend = recent[recent.length - 1] - recent[0];
        const threshold = 5 * 1024 * 1024; // 5MB

        if (trend > threshold) {
          console.warn(
            `🚨 Potential memory leak detected: ${(trend / 1024 / 1024).toFixed(2)}MB increase over last 10 snapshots`,
          );
        }
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(takeMemorySnapshot, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [takeMemorySnapshot]);

  return {
    takeMemorySnapshot,
    memorySnapshots: memorySnapshots.current,
  };
}
