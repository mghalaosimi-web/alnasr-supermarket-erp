export {};
declare global {
  interface Window {
    alnasr: {
      request<T = unknown>(request: { path: string; method?: "GET" | "POST" | "PUT"; token?: string; body?: unknown }): Promise<{ status: number; data: T }>;
    };
  }
}