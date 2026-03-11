import { describe, it, expect } from 'vitest';
import { render } from '../../support/render-utils';
import { StatusDot } from '@/components/agent-todo/StatusDot';

/**
 * Tests for StatusDot component
 * Covers all status variants and sizes
 */
describe('StatusDot', () => {
  describe('Status Colors', () => {
    it('renders gray color for idle status', () => {
      const { container } = render(<StatusDot status="idle" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-gray-400');
    });

    it('renders animated dark color for running status', () => {
      const { container } = render(<StatusDot status="running" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-notion-text', 'animate-pulse');
    });

    it('renders green color for completed status', () => {
      const { container } = render(<StatusDot status="completed" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-green-500');
    });

    it('renders red color for failed status', () => {
      const { container } = render(<StatusDot status="failed" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-red-500');
    });

    it('renders amber color for scheduled status', () => {
      const { container } = render(<StatusDot status="scheduled" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-amber-500');
    });

    it('renders gray color for cancelled status', () => {
      const { container } = render(<StatusDot status="cancelled" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-gray-400');
    });

    it('renders gray color for pending status', () => {
      const { container } = render(<StatusDot status="pending" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-gray-400');
    });

    it('renders gray color for unknown status', () => {
      const { container } = render(<StatusDot status="unknown" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-gray-400');
    });
  });

  describe('Size Variants', () => {
    it('renders medium size by default', () => {
      const { container } = render(<StatusDot status="idle" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('h-2.5', 'w-2.5');
    });

    it('renders small size when specified', () => {
      const { container } = render(<StatusDot status="idle" size="sm" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('h-2', 'w-2');
    });

    it('renders medium size when explicitly specified', () => {
      const { container } = render(<StatusDot status="idle" size="md" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('h-2.5', 'w-2.5');
    });
  });

  describe('Shape and Layout', () => {
    it('renders as a circle', () => {
      const { container } = render(<StatusDot status="idle" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('rounded-full');
    });

    it('does not shrink when container is small', () => {
      const { container } = render(<StatusDot status="idle" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('flex-shrink-0');
    });

    it('renders as inline-block', () => {
      const { container } = render(<StatusDot status="idle" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('inline-block');
    });
  });
});
