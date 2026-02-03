// Quick test to verify useParams behavior
import { BrowserRouter, useParams } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

const TestComponent = () => {
  const { id } = useParams<{ id: string }>();
  return <div>ID: {id || 'undefined'}</div>;
};

const TestWrapper = () => (
  <BrowserRouter>
    <TestComponent />
  </BrowserRouter>
);

render(<TestWrapper />);
console.log(screen.debug());
