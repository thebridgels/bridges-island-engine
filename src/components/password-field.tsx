"use client";

import { useState } from "react";

// A password input with an accessible show/hide toggle. Presentation only —
// it carries the given id/name through unchanged, so labels and form
// submission (FormData) behave exactly as a plain <input type="password">.
type PasswordFieldProps = {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
};

export function PasswordField({
  id,
  name,
  autoComplete,
  required,
  minLength,
  placeholder,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-sm dark:border-gray-700 dark:bg-gray-900"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
