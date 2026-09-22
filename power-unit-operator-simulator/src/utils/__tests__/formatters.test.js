import { formatTime, nowTime, typeLabel } from '../formatters';

describe('formatters utility functions', () => {
  test('formatTime correctly formats seconds to MM:SS string', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9)).toBe('00:09');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(367)).toBe('06:07');
    expect(formatTime(3600)).toBe('60:00');
  });

  test('typeLabel returns localized human-readable event category', () => {
    expect(typeLabel('student')).toBe('Действие оператора');
    expect(typeLabel('instructor')).toBe('Действие инструктора');
    expect(typeLabel('alarm')).toBe('Сигнализация');
    expect(typeLabel('system')).toBe('Система');
    expect(typeLabel('unknown')).toBe('unknown');
  });

  test('nowTime returns valid non-empty time string', () => {
    const timeStr = nowTime();
    expect(typeof timeStr).toBe('string');
    expect(timeStr.length).toBeGreaterThanOrEqual(5);
  });
});
