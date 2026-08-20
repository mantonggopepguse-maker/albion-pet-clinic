import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClinicalCalculators } from '../components/views/ClinicalCalculators';

describe('ClinicalCalculators Component', () => {
  it('renders with default Dose calculation mode', () => {
    render(<ClinicalCalculators />);
    expect(screen.getByText('Clinical Intelligence')).toBeInTheDocument();
    expect(screen.getByText(/Drug Dosing/i)).toBeInTheDocument();
    expect(screen.getByText(/CRI/i)).toBeInTheDocument();
    expect(screen.getByText(/Fluid Therapy/i)).toBeInTheDocument();
  });

  it('calculates drug dose in mg and ml correctly', () => {
    const { container } = render(<ClinicalCalculators />);

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    // Weight: 10 kg, Dose Rate: 5 mg/kg, Concentration: 25 mg/ml
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.change(inputs[1], { target: { value: '5' } });
    fireEvent.change(inputs[2], { target: { value: '25' } });

    // Total mg = 10 * 5 = 50 mg
    // Total ml = 50 / 25 = 2 ml
    expect(screen.getByText(/50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/2\.00/)).toBeInTheDocument();
  });

  it('switches to Fluid Therapy mode and calculates fluid requirements', () => {
    const { container } = render(<ClinicalCalculators />);

    fireEvent.click(screen.getByText(/Fluid Therapy/i));

    const inputs = container.querySelectorAll('input');
    // Weight = 20 kg
    fireEvent.change(inputs[0], { target: { value: '20' } });
    // Dehydration = 5 %
    fireEvent.change(inputs[1], { target: { value: '5' } });

    // Deficit: 20 * 0.05 * 1000 = 1,000 ml
    // Maintenance (50 ml/kg/day): 20 * 50 = 1,000 ml/day
    // Total 24h: 2,000 ml
    // Target Infusion Rate: 2000 / 24 = 83.3 ml/hr
    expect(screen.getByText(/Total 24h Requirement/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Infusion Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/83\.3/)).toBeInTheDocument();
  });
});
