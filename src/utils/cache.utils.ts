// src/utils/cache.utils.ts

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheManager {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 100; // Máximo número de items en cache
  
  // Establecer un valor en cache con TTL
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Limpiar cache si está lleno
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  // Obtener un valor del cache
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Verificar si el item ha expirado
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  // Eliminar un item específico del cache
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  // Limpiar items expirados
  private cleanup(): void {
    const now = Date.now();
    
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
    
    // Si aún está lleno, eliminar los items más antiguos
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Eliminar la mitad de los items más antiguos
      const toDelete = Math.floor(this.maxSize / 2);
      for (let i = 0; i < toDelete; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
  
  // Limpiar todo el cache
  clear(): void {
    this.cache.clear();
  }
  
  // Obtener estadísticas del cache
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Implementar si necesitas estadísticas detalladas
    };
  }
  
  // Generar key para cache basado en parámetros
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join(',');
    
    return `${prefix}:${sortedParams}`;
  }
}

// Instancia singleton del cache
export const cacheManager = new CacheManager();

// Hook para usar cache en componentes
export const useCache = () => {
  return {
    set: cacheManager.set.bind(cacheManager),
    get: cacheManager.get.bind(cacheManager),
    delete: cacheManager.delete.bind(cacheManager),
    clear: cacheManager.clear.bind(cacheManager),
    generateKey: cacheManager.generateKey.bind(cacheManager)
  };
};

// Decorador para cachear resultados de funciones
export function cached(ttl: number = 5 * 60 * 1000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const key = cacheManager.generateKey(
        `${target.constructor.name}.${propertyKey}`,
        { args: JSON.stringify(args) }
      );
      
      // Intentar obtener del cache
      let result = cacheManager.get(key);
      if (result !== null) {
        return result;
      }
      
      // Ejecutar función original y cachear resultado
      result = await originalMethod.apply(this, args);
      cacheManager.set(key, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

export default cacheManager;