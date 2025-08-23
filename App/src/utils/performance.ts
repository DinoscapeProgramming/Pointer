/**
 * Performance monitoring utilities for chat resize operations
 */

interface PerformanceMetrics {
  resizeStartTime: number;
  frameCount: number;
  droppedFrames: number;
  averageFrameTime: number;
}

class ResizePerformanceMonitor {
  private metrics: PerformanceMetrics = {
    resizeStartTime: 0,
    frameCount: 0,
    droppedFrames: 0,
    averageFrameTime: 0,
  };
  
  private frameTimeSum = 0;
  private lastFrameTime = 0;
  private isMonitoring = false;

  startMonitoring() {
    this.metrics.resizeStartTime = performance.now();
    this.metrics.frameCount = 0;
    this.metrics.droppedFrames = 0;
    this.frameTimeSum = 0;
    this.lastFrameTime = this.metrics.resizeStartTime;
    this.isMonitoring = true;
    
    console.log('🔍 Starting resize performance monitoring');
  }

  recordFrame() {
    if (!this.isMonitoring) return;
    
    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    
    this.metrics.frameCount++;
    this.frameTimeSum += frameTime;
    
    // Consider frame dropped if it takes longer than 20ms (< 50fps)
    if (frameTime > 20) {
      this.metrics.droppedFrames++;
    }
    
    this.lastFrameTime = currentTime;
  }

  stopMonitoring(): PerformanceMetrics {
    if (!this.isMonitoring) return this.metrics;
    
    this.isMonitoring = false;
    this.metrics.averageFrameTime = this.frameTimeSum / this.metrics.frameCount;
    
    const totalTime = performance.now() - this.metrics.resizeStartTime;
    const fps = (this.metrics.frameCount / (totalTime / 1000)).toFixed(1);
    const dropRate = ((this.metrics.droppedFrames / this.metrics.frameCount) * 100).toFixed(1);
    
    console.log(`📊 Resize Performance Report:
      Duration: ${totalTime.toFixed(1)}ms
      Frames: ${this.metrics.frameCount}
      Average FPS: ${fps}
      Dropped frames: ${this.metrics.droppedFrames} (${dropRate}%)
      Average frame time: ${this.metrics.averageFrameTime.toFixed(2)}ms
    `);
    
    return { ...this.metrics };
  }
}

// Global instance
export const resizePerformanceMonitor = new ResizePerformanceMonitor();

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  let lastExecTime = 0;
  
  return (...args: Parameters<T>) => {
    const currentTime = performance.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = performance.now();
      }, delay - (currentTime - lastExecTime)) as unknown as number;
    }
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => func(...args), delay) as unknown as number;
  };
} 