import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { formatNumber, parseNumberInput, SliderNumberField, type SliderNumberFieldProps } from '@/components/controls/SliderNumberField';
import { PROPERTIES } from '@/engine/model/properties';

function Harness(p: Partial<SliderNumberFieldProps> & { initial: number; spy?: (v: number) => void }) {
  const [v, setV] = useState(p.initial);
  return <SliderNumberField label="Campo" {...p} value={v} onChange={(x) => { setV(x); p.spy?.(x); }} />;
}
const number = () => screen.getByRole('textbox') as HTMLInputElement;
const slider = () => screen.getByRole('slider') as HTMLInputElement;
const type = (t: string) => fireEvent.change(number(), { target: { value: t } });

describe('parseNumberInput', () => {
  it('entende negativos, decimais, vírgula e ponto', () => {
    expect(parseNumberInput('-150,5')).toBe(-150.5);
    expect(parseNumberInput('12.25')).toBe(12.25);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('  8 ')).toBe(8);
  });
  it('estados intermediários não viram número', () => {
    for (const t of ['', '-', '+', '.', 'abc', '1,2,3', '--2']) expect(parseNumberInput(t)).toBeNull();
  });
  it('formata em pt-BR sem -0', () => {
    expect(formatNumber(12.5, 1)).toBe('12,5');
    expect(formatNumber(-0, 1)).toBe('0');
  });
});

describe('SliderNumberField', () => {
  it('slider atualiza o número sem atraso', () => {
    render(<Harness initial={10} sliderMin={0} sliderMax={100} />);
    fireEvent.change(slider(), { target: { value: '42' } });
    expect(number().value).toBe('42');
  });
  it('digitar atualiza slider e valor', () => {
    const spy = vi.fn();
    render(<Harness initial={10} sliderMin={0} sliderMax={100} spy={spy} />);
    fireEvent.focus(number());
    type('55');
    expect(spy).toHaveBeenLastCalledWith(55);
    expect(slider().value).toBe('55');
  });
  it('aceita negativo com decimais (X = -150,5)', () => {
    const spy = vi.fn();
    render(<Harness initial={0} sliderMin={-1400} sliderMax={1400} step={0.5} spy={spy} />);
    fireEvent.focus(number());
    type('-150,5');
    expect(spy).toHaveBeenLastCalledWith(-150.5);
    fireEvent.blur(number());
    expect(number().value).toBe('-150,5');
  });
  it('não sobrescreve a digitação intermediária', () => {
    const spy = vi.fn();
    render(<Harness initial={10} sliderMin={0} sliderMax={100} spy={spy} />);
    fireEvent.focus(number());
    type('');
    expect(number().value).toBe('');
    type('-');
    expect(number().value).toBe('-');
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    type('-7');
    expect(spy).toHaveBeenLastCalledWith(-7);
  });
  it('vazio ao confirmar volta ao último valor válido', () => {
    render(<Harness initial={33} sliderMin={0} sliderMax={100} />);
    fireEvent.focus(number());
    type('');
    fireEvent.blur(number());
    expect(number().value).toBe('33');
  });
  it('texto inválido mostra erro e não altera', () => {
    const spy = vi.fn();
    render(<Harness initial={33} sliderMin={0} sliderMax={100} spy={spy} />);
    fireEvent.focus(number());
    type('abc');
    expect(screen.getByRole('alert').textContent).toMatch(/número válido/);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.blur(number());
    expect(number().value).toBe('33');
    expect(screen.getByRole('alert').textContent).toMatch(/anterior mantido/);
  });
  it('além do slider: mantém o valor e o slider satura', () => {
    const spy = vi.fn();
    render(<Harness initial={0} sliderMin={0} sliderMax={100} spy={spy} />);
    fireEvent.focus(number());
    type('250');
    fireEvent.blur(number());
    expect(spy).toHaveBeenLastCalledWith(250);
    expect(number().value).toBe('250');
    expect(slider().value).toBe('100');
    expect(slider().classList.contains('is-saturated')).toBe(true);
  });
  it('além do limite real: avisa e ajusta, nunca trunca em silêncio', () => {
    const spy = vi.fn();
    render(<Harness initial={0.5} min={0} max={1} display={100} sliderMin={0} sliderMax={100} unit="%" spy={spy} />);
    fireEvent.focus(number());
    type('150');
    expect(screen.getByRole('alert').textContent).toMatch(/Máximo: 100/);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.blur(number());
    expect(spy).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('alert').textContent).toMatch(/ajustado/);
  });
  it('display converte (125 % = 1,25 guardado)', () => {
    const spy = vi.fn();
    render(<Harness initial={1} display={100} sliderMin={5} sliderMax={300} unit="%" spy={spy} />);
    expect(number().value).toBe('100');
    fireEvent.focus(number());
    type('125');
    expect(spy).toHaveBeenLastCalledWith(1.25);
    expect(screen.getByText('%')).toBeTruthy();
  });
  it('Enter confirma e Esc cancela a edição', () => {
    render(<Harness initial={10} sliderMin={0} sliderMax={100} />);
    fireEvent.focus(number());
    type('20');
    fireEvent.keyDown(number(), { key: 'Enter' });
    expect(number().value).toBe('20');
    fireEvent.focus(number());
    type('');
    fireEvent.keyDown(number(), { key: 'Escape' });
    expect(number().value).toBe('20');
  });
  it('botões de passo incrementam respeitando limites', () => {
    render(<Harness initial={99} min={0} max={100} step={1} sliderMin={0} sliderMax={100} />);
    fireEvent.click(screen.getByLabelText('Aumentar Campo'));
    expect(number().value).toBe('100');
    fireEvent.click(screen.getByLabelText('Aumentar Campo'));
    expect(number().value).toBe('100');
    fireEvent.click(screen.getByLabelText('Diminuir Campo'));
    expect(number().value).toBe('99');
  });
  it('um gesto: abre e fecha um único grupo de histórico', () => {
    const start = vi.fn();
    const end = vi.fn();
    render(<Harness initial={0} sliderMin={0} sliderMax={100} onGestureStart={start} onGestureEnd={end} />);
    fireEvent.pointerDown(slider());
    for (let i = 0; i < 10; i++) fireEvent.change(slider(), { target: { value: String(i * 5) } });
    fireEvent.pointerUp(slider());
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('tem rótulo acessível e teclado decimal', () => {
    render(<Harness initial={0} sliderMin={0} sliderMax={1} />);
    expect(screen.getByLabelText('Campo')).toBe(number());
    expect(number().getAttribute('inputmode')).toBe('decimal');
  });
  it('valor externo atualiza quando não está digitando', () => {
    const { rerender } = render(<SliderNumberField label="X" value={1} onChange={() => {}} sliderMin={0} sliderMax={10} />);
    rerender(<SliderNumberField label="X" value={7} onChange={() => {}} sliderMin={0} sliderMax={10} />);
    expect(number().value).toBe('7');
  });
});

describe('esquema único de propriedades', () => {
  it('toda propriedade numérica declara alcance e rótulo', () => {
    for (const p of PROPERTIES.filter((x) => x.kind === 'number')) {
      expect(p.sliderMin, p.path).toBeDefined();
      expect(p.sliderMax, p.path).toBeDefined();
      expect(p.label.length, p.path).toBeGreaterThan(1);
    }
  });
});
