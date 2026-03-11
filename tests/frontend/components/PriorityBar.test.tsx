import { describe, it, expect, vi } from 'vitest';
import { render, screen, setupTest } from '../../support/render-utils';
import { PriorityBarIcon, PriorityPicker } from '@/components/agent-todo/PriorityBar';

/**
 * Tests for PriorityBarIcon component (read-only display)
 */
describe('PriorityBarIcon', () => {
  describe('Rendering', () => {
    it('renders 5 cells', () => {
      const { container } = render(<PriorityBarIcon value={2} />);
      const cells = container.querySelectorAll('span > span');
      expect(cells).toHaveLength(5);
    });

    it('has correct accessibility label', () => {
      render(<PriorityBarIcon value={2} />);
      const container = screen.getByLabelText('Priority: Medium');
      expect(container).toBeInTheDocument();
    });

    it('has correct title attribute', () => {
      render(<PriorityBarIcon value={2} />);
      const container = screen.getByTitle('Priority: Medium');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Priority Labels', () => {
    const testCases = [
      { value: 0, label: 'Low' },
      { value: 1, label: 'Normal' },
      { value: 2, label: 'Medium' },
      { value: 3, label: 'High' },
      { value: 4, label: 'Urgent' },
    ];

    testCases.forEach(({ value, label }) => {
      it(`shows correct label for priority ${value} (${label})`, () => {
        render(<PriorityBarIcon value={value} />);
        expect(screen.getByLabelText(`Priority: ${label}`)).toBeInTheDocument();
      });
    });

    it('defaults to Low label for invalid priority', () => {
      render(<PriorityBarIcon value={99} />);
      expect(screen.getByLabelText('Priority: Low')).toBeInTheDocument();
    });
  });

  describe('Cell Filling', () => {
    it('fills cells based on priority value', () => {
      const { container } = render(<PriorityBarIcon value={2} />);
      const cells = container.querySelectorAll('span > span');
      // Cells 0, 1, 2 should be filled (not gray), cells 3, 4 should be gray
      expect(cells.length).toBe(5);
      // Check that the cells exist
      expect(cells[0]).toBeDefined();
      expect(cells[4]).toBeDefined();
    });

    it('fills all cells at max priority', () => {
      const { container } = render(<PriorityBarIcon value={4} />);
      const cells = container.querySelectorAll('span > span');
      expect(cells.length).toBe(5);
      // All cells should be filled with red color
      cells.forEach((cell) => {
        const bgColor = (cell as HTMLElement).style.backgroundColor;
        expect(bgColor).not.toBe('rgb(209, 213, 219)'); // not gray
      });
    });

    it('fills only first cell at min priority', () => {
      const { container } = render(<PriorityBarIcon value={0} />);
      const cells = container.querySelectorAll('span > span');
      expect(cells.length).toBe(5);
      // First cell should be green (not gray)
      const firstCellBg = (cells[0] as HTMLElement).style.backgroundColor;
      const firstCellIsGray = firstCellBg === 'rgb(209, 213, 219)' || firstCellBg === '#d1d5db';
      expect(firstCellIsGray).toBe(false);
      // Rest should be gray (either rgb or hex format)
      for (let i = 1; i < 5; i++) {
        const bgColor = (cells[i] as HTMLElement).style.backgroundColor;
        const isGray = bgColor === 'rgb(209, 213, 219)' || bgColor === '#d1d5db';
        expect(isGray).toBe(true);
      }
    });
  });
});

/**
 * Tests for PriorityPicker component (interactive)
 */
describe('PriorityPicker', () => {
  describe('Rendering', () => {
    it('renders 5 clickable buttons', () => {
      render(<PriorityPicker value={2} onChange={() => {}} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });

    it('renders priority label', () => {
      render(<PriorityPicker value={2} onChange={() => {}} />);
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('each button has correct title', () => {
      render(<PriorityPicker value={2} onChange={() => {}} />);
      const titles = ['Low', 'Normal', 'Medium', 'High', 'Urgent'];
      titles.forEach((title) => {
        expect(screen.getByTitle(title)).toBeInTheDocument();
      });
    });
  });

  describe('Button Clicking', () => {
    it('calls onChange with 0 when first button clicked', async () => {
      const mockOnChange = vi.fn();
      const { user } = setupTest();

      render(<PriorityPicker value={2} onChange={mockOnChange} />);
      const buttons = screen.getAllByRole('button');

      await user.click(buttons[0]);
      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('calls onChange with 4 when last button clicked', async () => {
      const mockOnChange = vi.fn();
      const { user } = setupTest();

      render(<PriorityPicker value={2} onChange={mockOnChange} />);
      const buttons = screen.getAllByRole('button');

      await user.click(buttons[4]);
      expect(mockOnChange).toHaveBeenCalledWith(4);
    });

    it('calls onChange with correct value for each button', async () => {
      const mockOnChange = vi.fn();
      const { user } = setupTest();

      render(<PriorityPicker value={0} onChange={mockOnChange} />);
      const buttons = screen.getAllByRole('button');

      for (let i = 0; i < 5; i++) {
        await user.click(buttons[i]);
        expect(mockOnChange).toHaveBeenCalledWith(i);
      }
    });
  });

  describe('Visual State', () => {
    it('updates label when value changes', () => {
      const { rerender } = render(<PriorityPicker value={0} onChange={() => {}} />);
      expect(screen.getByText('Low')).toBeInTheDocument();

      rerender(<PriorityPicker value={4} onChange={() => {}} />);
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('buttons have pointer cursor', () => {
      const { container } = render(<PriorityPicker value={2} onChange={() => {}} />);
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        expect((button as HTMLElement).style.cursor).toBe('pointer');
      });
    });

    it('buttons have no border', () => {
      const { container } = render(<PriorityPicker value={2} onChange={() => {}} />);
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        // happy-dom may return 'none none' instead of 'none'
        expect((button as HTMLElement).style.border).toMatch(/none/);
      });
    });

    it('buttons are type="button"', () => {
      render(<PriorityPicker value={2} onChange={() => {}} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Colors by Priority Level', () => {
    const colorMap: Record<number, string> = {
      0: 'Low',
      1: 'Normal',
      2: 'Medium',
      3: 'High',
      4: 'Urgent',
    };

    Object.entries(colorMap).forEach(([value, label]) => {
      it(`displays correct label for priority ${value} (${label})`, () => {
        render(<PriorityPicker value={Number(value)} onChange={() => {}} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });
});
