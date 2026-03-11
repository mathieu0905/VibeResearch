/**
 * Test utilities for rendering React components with router context
 */
import React from 'react';
import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, type MemoryRouterProps } from 'react-router-dom';
import { setMockOverride } from './frontend-setup';

/**
 * Custom render function that wraps components with router context
 */
interface CustomRenderOptions {
  routerProps?: MemoryRouterProps;
  routes?: Array<{ path: string; element: React.ReactNode }>;
}

function render(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { routerProps, routes } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter {...routerProps}>
      {routes ? (
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={children} />
        </Routes>
      ) : (
        children
      )}
    </MemoryRouter>
  );

  return {
    ...rtlRender(ui, { wrapper: Wrapper }),
    // Return userEvent setup for interaction tests
    user: userEvent.setup(),
  };
}

/**
 * Helper to find elements by data-testid with better error messages
 */
function getByTestId(testId: string) {
  return screen.getByTestId(testId);
}

function queryByTestId(testId: string) {
  return screen.queryByTestId(testId);
}

function findByTestId(testId: string, timeout = 1000) {
  return screen.findByTestId(testId, {}, { timeout });
}

/**
 * Helper to get elements within a container
 */
function withinElement(element: HTMLElement) {
  return within(element);
}

/**
 * Mock IPC response for a specific channel
 * Uses setMockOverride from frontend-setup.ts to survive vi.clearAllMocks()
 */
function mockIPCResponse<T>(channel: string, response: T) {
  setMockOverride(channel, response);
}

/**
 * Setup function that returns common test utilities
 */
function setupTest() {
  return {
    user: userEvent.setup(),
    screen,
    render,
    getByTestId,
    queryByTestId,
    findByTestId,
    withinElement,
    mockIPCResponse,
  };
}

// Re-export everything from testing-library for convenience
export * from '@testing-library/react';
export { userEvent };
export {
  render,
  getByTestId,
  queryByTestId,
  findByTestId,
  withinElement,
  mockIPCResponse,
  setupTest,
};
