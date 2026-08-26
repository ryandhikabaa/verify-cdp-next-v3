import {useEffect, useState} from 'react';

/** Renders a labeled numeric input with consistent styling. */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [textValue, setTextValue] = useState(String(value));

  useEffect(() => {
    setTextValue(String(value));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={textValue}
        onChange={(event) => {
          const digitsOnly = event.target.value.replace(/\D/g, '');
          if (digitsOnly === '') {
            setTextValue('');
            return;
          }

          const normalized = digitsOnly.replace(/^0+(?=\d)/, '');
          const nextValue = Math.min(Math.max(Number(normalized), min), max);
          setTextValue(String(nextValue));
          onChange(nextValue);
        }}
        onBlur={() => {
          if (textValue === '') {
            setTextValue(String(min));
            onChange(min);
            return;
          }

          const clampedValue = Math.min(Math.max(Number(textValue), min), max);
          setTextValue(String(clampedValue));
          onChange(clampedValue);
        }}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
      />
    </label>
  );
}
