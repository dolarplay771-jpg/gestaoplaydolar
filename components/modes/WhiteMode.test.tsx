import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhiteMode } from './WhiteMode';

const addTransactionMock = vi.fn();

vi.mock('../../context/BankrollContext', () => ({
  useBankroll: () => ({
    currentBalance: 1000,
    riskPercentage: 2,
    addTransaction: addTransactionMock,
    usdToBrlRate: 5,
  }),
}));

describe('WhiteMode', () => {
  it('mostra entrada em USD e BRL e registra WIN', async () => {
    const user = userEvent.setup();
    render(<WhiteMode />);

    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?100,00/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /win/i }));

    expect(addTransactionMock).toHaveBeenCalledWith(
      'WIN',
      16.8,
      'MODO_BRANCO',
      'Win @ 84%'
    );
  });
});
