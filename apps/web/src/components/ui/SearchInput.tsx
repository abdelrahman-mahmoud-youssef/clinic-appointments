'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from './FormControls';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}

export function SearchInput({ value, onChange, placeholder, className, delay = 300 }: Props) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onChangeRef.current(local), delay);
    return () => clearTimeout(timer);
  }, [local, value, delay]);

  return (
    <Input
      type="search"
      value={local}
      placeholder={placeholder}
      className={className}
      onChange={(event) => setLocal(event.target.value)}
    />
  );
}
