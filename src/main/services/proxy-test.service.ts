import * as https from 'node:https';
import * as http from 'node:http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxy } from '../store/app-settings-store';

export interface ProxyTestResult {
  url: string;
  name: string;
  success: boolean;
  latency?: number; // ms
  error?: string;
}

// Test endpoints that are commonly blocked in China
const TEST_ENDPOINTS = [
  { url: 'https://www.google.com', name: 'Google' },
  { url: 'https://github.com', name: 'GitHub' },
  { url: 'https://www.youtube.com', name: 'YouTube' },
];

function makeProxyAgent(proxyUrl: string | undefined): http.Agent | undefined {
  if (!proxyUrl) return undefined;
  return new HttpsProxyAgent(proxyUrl);
}

/**
 * Test a single endpoint using node:https so the agent is actually honoured.
 */
function testEndpoint(
  urlStr: string,
  agent?: http.Agent,
): Promise<{ success: boolean; latency?: number; error?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const timeout = 10_000;

    const req = https.request(
      urlStr,
      {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VibeResearch/1.0)' },
        ...(agent ? { agent } : {}),
        timeout,
      },
      (res) => {
        const latency = Date.now() - startTime;
        res.resume(); // drain
        const status = res.statusCode ?? 0;
        if (status > 0 && status < 400) {
          resolve({ success: true, latency });
        } else {
          resolve({ success: false, latency, error: `HTTP ${status}` });
        }
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, latency: timeout, error: 'Timeout (10s)' });
    });

    req.on('error', (err) => {
      const latency = Date.now() - startTime;
      resolve({ success: false, latency, error: err.message });
    });

    req.end();
  });
}

/**
 * Test proxy connectivity to common endpoints.
 * proxyUrl overrides the saved store value when provided.
 */
export async function testProxyConnectivity(proxyUrl?: string): Promise<ProxyTestResult[]> {
  const url = proxyUrl !== undefined ? proxyUrl : getProxy();
  const agent = makeProxyAgent(url);
  const results: ProxyTestResult[] = [];

  for (const endpoint of TEST_ENDPOINTS) {
    const result = await testEndpoint(endpoint.url, agent);
    results.push({ url: endpoint.url, name: endpoint.name, ...result });
  }

  return results;
}

/**
 * Test if proxy is configured and working.
 * proxyUrl overrides the saved store value when provided.
 */
export async function testProxy(proxyUrl?: string): Promise<{
  hasProxy: boolean;
  results: ProxyTestResult[];
}> {
  const url = proxyUrl !== undefined ? proxyUrl : getProxy();
  const results = await testProxyConnectivity(url);
  return { hasProxy: !!url, results };
}
