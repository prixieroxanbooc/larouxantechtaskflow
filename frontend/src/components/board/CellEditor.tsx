import { useState } from 'react';
import { Column, StatusOption } from '@/types';

interface Props {
  column: Column;
  value: string;
  onChange: (val: string) => void;
}

function getStatusOptions(column: Column): StatusOption[] {
  try {
    const s = JSON.parse(column.settings);
    return s.options ?? [];
  } catch {
    return [];
  }
}

export default function CellEditor({ column, value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);

  const commit = (v: string) => { onChange(v); setEditing(false); };

  const cls = 'w-32 shrink-0 px-2 text-sm';

  if (column.type === 'status') {
    const options = getStatusOptions(column);
    const current = options.find((o) => o.label === value);
    return (
      <div className={`${cls} relative`}>
        {editing ? (
          <div className="absolute z-20 top-0 left-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px] overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => commit(opt.label)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                {opt.label}
              </button>
            ))}
            <button onClick={() => commit('')} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100">
              Clear
            </button>
          </div>
        ) : null}
        <button
          onClick={() => setEditing(!editing)}
          className="w-full text-center py-0.5 rounded text-xs font-medium truncate transition-colors"
          style={current ? { backgroundColor: current.color + '33', color: current.color } : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}
        >
          {value || 'None'}
        </button>
        {editing && <div className="fixed inset-0 z-10" onClick={() => setEditing(false)} />}
      </div>
    );
  }

  if (column.type === 'checkbox') {
    return (
      <div className={`${cls} flex justify-center`}>
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="w-4 h-4 rounded border-gray-300 text-brand-500 cursor-pointer"
        />
      </div>
    );
  }

  if (column.type === 'date') {
    return (
      <div className={cls}>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs text-gray-600 border-0 bg-transparent w-full focus:outline-none focus:ring-1 focus:ring-brand-400 rounded px-1"
        />
      </div>
    );
  }

  return (
    <div className={cls}>
      {editing ? (
        <input
          autoFocus
          type={column.type === 'number' ? 'number' : column.type === 'email' ? 'email' : column.type === 'url' ? 'url' : 'text'}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={() => commit(localVal)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(localVal); if (e.key === 'Escape') setEditing(false); }}
          className="w-full text-xs border border-brand-400 rounded px-1 py-0.5 outline-none"
        />
      ) : (
        <span
          className="block truncate text-xs text-gray-600 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 min-h-[20px]"
          onClick={() => { setLocalVal(value); setEditing(true); }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
