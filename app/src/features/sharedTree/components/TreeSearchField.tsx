import type { Ref } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  resultCount?: number;
  inputRef?: Ref<HTMLInputElement>;
}

export default function TreeSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  resultCount,
  inputRef,
}: Props) {
  return (
    <div className="search__field tree-search-field">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
      />
      {value && resultCount != null && (
        <span className="search__count">{resultCount.toLocaleString()}</span>
      )}
    </div>
  );
}
