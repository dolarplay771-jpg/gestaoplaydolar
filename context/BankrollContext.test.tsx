import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BankrollProvider, useBankroll } from './BankrollContext';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const Probe: React.FC = () => {
  const { usdToBrlRate, convertUsdToBrl } = useBankroll();
  return (
    <div>
      <span data-testid="rate">{usdToBrlRate}</span>
      <span data-testid="converted">{convertUsdToBrl(10)}</span>
    </div>
  );
};

describe('BankrollContext', () => {
  it('aplica cotacao USD->BRL e expoe conversao', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ USDBRL: { bid: '5.5' } }),
      })
    );

    render(
      <BankrollProvider>
        <Probe />
      </BankrollProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rate')).toHaveTextContent('5.5');
      expect(screen.getByTestId('converted')).toHaveTextContent('55');
    });
  });
});
