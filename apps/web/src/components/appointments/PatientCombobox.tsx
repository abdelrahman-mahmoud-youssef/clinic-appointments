'use client';

import { useMemo, useRef, useState } from 'react';
import { Patient } from '@/lib/api/patients';
import { Input } from '@/components/ui/FormControls';

export interface PatientChoice {
  patientId?: string;
  newPatientName?: string;
}

interface Props {
  patients: Patient[];
  value: PatientChoice;
  onChange: (choice: PatientChoice) => void;
}

export function PatientCombobox({ patients, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectedPatient = value.patientId
    ? patients.find((patient) => patient.id === value.patientId)
    : undefined;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? patients.filter((patient) => patient.name.toLowerCase().includes(needle))
      : patients;
    return list.slice(0, 8);
  }, [patients, query]);

  if (value.newPatientName !== undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Input
          value={value.newPatientName}
          onChange={(event) => onChange({ newPatientName: event.target.value })}
          placeholder="New patient name"
          autoFocus
          required
        />
        <button
          type="button"
          className="self-start text-xs text-brand hover:underline"
          onClick={() => {
            onChange({});
            setQuery('');
          }}
        >
          Choose an existing patient instead
        </button>
      </div>
    );
  }

  if (selectedPatient) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
        <span className="text-sm text-ink">{selectedPatient.name}</span>
        <button
          type="button"
          className="text-xs text-brand hover:underline"
          onClick={() => {
            onChange({});
            setQuery('');
            setOpen(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Search patients…"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg">
          {filtered.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-bg"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange({ patientId: patient.id });
                  setOpen(false);
                }}
              >
                {patient.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-faint">No matching patients</li>
          )}
          <li className="border-t border-line">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm font-medium text-brand hover:bg-bg"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange({ newPatientName: query.trim() });
                setOpen(false);
              }}
            >
              + Add new patient{query.trim() ? `: "${query.trim()}"` : ''}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
