import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

afterEach(() => vi.useRealTimers());

describe('SearchInput', () => {
  it('keeps Vietnamese input intact and commits once after the composition ends', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(
      <SearchInput ariaLabel="Tìm" value={undefined} onCommit={onCommit} />,
    );
    const box = screen.getByLabelText<HTMLInputElement>('Tìm');
    fireEvent.compositionStart(box);
    for (const text of ['V', 'Vo', 'Võ']) {
      fireEvent.change(box, { target: { value: text } });
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(box, { target: { value: 'Võ' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(box.value).toBe('Võ');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Võ');
  });
  it('commits trimmed text after a pause, and undefined when cleared', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<SearchInput ariaLabel="Tìm" value="cũ" onCommit={onCommit} />);
    const box = screen.getByLabelText<HTMLInputElement>('Tìm');
    fireEvent.change(box, { target: { value: ' 102230239 ' } });
    act(() => vi.advanceTimersByTime(399));
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onCommit).toHaveBeenLastCalledWith('102230239');
    fireEvent.change(box, { target: { value: '' } });
    act(() => vi.advanceTimersByTime(400));
    expect(onCommit).toHaveBeenLastCalledWith(undefined);
  });
  it('follows a value changed from outside', () => {
    const { rerender } = render(
      <SearchInput ariaLabel="Tìm" value="a" onCommit={vi.fn()} />,
    );
    rerender(<SearchInput ariaLabel="Tìm" value="b" onCommit={vi.fn()} />);
    expect(screen.getByLabelText<HTMLInputElement>('Tìm').value).toBe('b');
  });
});
