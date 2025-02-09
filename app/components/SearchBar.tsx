import { useState } from "react";

interface SearchBarProps {
  onSearch: (term: string) => void;
  disabled?: boolean;
}

export default function SearchBar({ onSearch, disabled }: SearchBarProps) {
  const [input, setInput] = useState("");

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <input
      disabled={disabled}
      type="text"
      value={input}
      onChange={handleOnChange}
      placeholder="検索..."
      className="px-4 py-2 border rounded mr-2 disabled:opacity-50"
    />
  );
}
