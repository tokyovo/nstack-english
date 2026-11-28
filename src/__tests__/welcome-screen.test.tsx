import { render, screen } from '@testing-library/react-native';

import WelcomeScreen from '@/app/index';

describe('Welcome screen', () => {
  it('shows the app name as the page heading and the Vietnamese tagline', async () => {
    await render(<WelcomeScreen />);

    expect(screen.getByRole('heading', { name: 'Học Tiếng Anh' })).toBeOnTheScreen();
    expect(screen.getByText('Học tiếng Anh từ con số không, mỗi ngày một chút.')).toBeOnTheScreen();
  });

  it('shows an English word in the notebook-grid card with its Vietnamese meaning', async () => {
    await render(<WelcomeScreen />);

    const card = screen.getByTestId('word-card');
    expect(card).toHaveTextContent('Hello', { exact: false });
    expect(card).toHaveTextContent('Xin chào', { exact: false });
  });
});
