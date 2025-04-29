import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioPicker } from '@/components/guardian-demo/ScenarioPicker';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ScenarioPicker', () => {
  const mockScenarios = ['velocity-breach', 'bank-swap', 'geo-mismatch'];
  const mockLabels = {
    'velocity-breach': 'Velocity Breach',
    'bank-swap': 'Bank Account Swap',
    'geo-mismatch': 'Geo-Location Mismatch',
  };

  const mockOnChange = vi.fn();
  const mockOnRestart = vi.fn();

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: () => {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders with the correct scenarios', () => {
    render(
      <ScenarioPicker
        scenarios={mockScenarios}
        scenarioLabels={mockLabels}
        currentScenario=""
        onChange={mockOnChange}
        onRestart={mockOnRestart}
      />,
    );

    // Open the select dropdown
    fireEvent.click(screen.getByRole('combobox'));

    // Check if all options are rendered
    expect(screen.getByText('Velocity Breach')).toBeInTheDocument();
    expect(screen.getByText('Bank Account Swap')).toBeInTheDocument();
    expect(screen.getByText('Geo-Location Mismatch')).toBeInTheDocument();
  });

  it('calls onChange and stores selection in localStorage when a scenario is selected', async () => {
    render(
      <ScenarioPicker
        scenarios={mockScenarios}
        scenarioLabels={mockLabels}
        currentScenario=""
        onChange={mockOnChange}
        onRestart={mockOnRestart}
      />,
    );

    // Open the select dropdown
    fireEvent.click(screen.getByRole('combobox'));

    // Select an option
    fireEvent.click(screen.getByText('Bank Account Swap'));

    // Check if onChange was called with the correct value
    expect(mockOnChange).toHaveBeenCalledWith('bank-swap');

    // Check if localStorage.setItem was called with the correct key and value
    expect(localStorageMock.setItem).toHaveBeenCalledWith('sg:scenario', 'bank-swap');
  });

  it('loads scenario from localStorage on mount if no currentScenario is provided', () => {
    // Setup localStorage with a stored scenario
    localStorageMock.getItem.mockReturnValue('geo-mismatch');

    render(
      <ScenarioPicker
        scenarios={mockScenarios}
        scenarioLabels={mockLabels}
        currentScenario=""
        onChange={mockOnChange}
        onRestart={mockOnRestart}
      />,
    );

    // Check if localStorage.getItem was called with the correct key
    expect(localStorageMock.getItem).toHaveBeenCalledWith('sg:scenario');

    // Check if onChange was called with the value from localStorage
    expect(mockOnChange).toHaveBeenCalledWith('geo-mismatch');
  });

  it('does not load from localStorage if currentScenario is already set', () => {
    render(
      <ScenarioPicker
        scenarios={mockScenarios}
        scenarioLabels={mockLabels}
        currentScenario="velocity-breach"
        onChange={mockOnChange}
        onRestart={mockOnRestart}
      />,
    );

    // localStorage.getItem should be called but onChange should not be called
    expect(localStorageMock.getItem).toHaveBeenCalledWith('sg:scenario');
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('calls onRestart when the restart button is clicked', () => {
    render(
      <ScenarioPicker
        scenarios={mockScenarios}
        scenarioLabels={mockLabels}
        currentScenario="velocity-breach"
        onChange={mockOnChange}
        onRestart={mockOnRestart}
      />,
    );

    // Click the restart button
    fireEvent.click(screen.getByText('Restart'));

    // Check if onRestart was called
    expect(mockOnRestart).toHaveBeenCalledTimes(1);
  });
});
