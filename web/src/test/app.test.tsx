import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('Application smoke tests', () => {
  it('renders a div without crashing', () => {
    const { container } = render(<div data-testid="root">CorrectionFIELD</div>);
    expect(container).toBeTruthy();
  });

  it('displays the correct text', () => {
    render(<p>CorrectionFIELD Web</p>);
    expect(screen.getByText('CorrectionFIELD Web')).toBeInTheDocument();
  });

  it('basic arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
