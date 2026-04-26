import { useQuery } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, LogOut, Plus, ChevronDown, KeyRound, Code2, BookOpen, Terminal } from 'lucide-react';
import { useState } from 'react';
import { boardsApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useDevMode } from '@/store/devModeStore';
import { Board } from '@/types';

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { enabled: devMode, toggle: toggleDev } = useDevMode();
  const [boardsOpen, setBoardsOpen] = useState(true);
  const [devOpen, setDevOpen] = useState(true);

  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ['boards'],
    queryFn: boardsApi.list,
  });

  const handleLogout = () => { logout(); navigate('/login'); };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📋</span>
          <span className="font-bold text-gray-900 text-lg">Larouxantech TaskFlow</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 ml-9">Work OS</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavLink to="/" end className={navCls}>
          <Home size={16} /> Home
        </NavLink>

        {/* Boards list */}
        <div className="pt-3">
          <button
            onClick={() => setBoardsOpen(!boardsOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
          >
            <span>My Boards</span>
            <ChevronDown size={14} className={`transition-transform ${boardsOpen ? '' : '-rotate-90'}`} />
          </button>

          {boardsOpen && (
            <div className="mt-1 space-y-0.5">
              {boards.map((board) => (
                <NavLink key={board.id} to={`/board/${board.id}`} className={navCls}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: board.color }} />
                  <span className="truncate">{board.icon} {board.name}</span>
                </NavLink>
              ))}
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              >
                <Plus size={14} /> New Board
              </button>
            </div>
          )}
        </div>

        {/* Developer Section — only visible when dev mode is ON */}
        {devMode && (
          <div className="pt-3">
            <button
              onClick={() => setDevOpen(!devOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-purple-400 uppercase tracking-wider hover:text-purple-600 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Terminal size={11} /> Developer
              </span>
              <ChevronDown size={14} className={`transition-transform ${devOpen ? '' : '-rotate-90'}`} />
            </button>

            {devOpen && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/developer/keys" className={navCls}>
                  <KeyRound size={15} className="text-purple-400" /> API Keys
                </NavLink>
                <NavLink to="/developer/oauth" className={navCls}>
                  <Code2 size={15} className="text-purple-400" /> OAuth Clients
                </NavLink>
                <NavLink to="/developer/docs" className={navCls}>
                  <BookOpen size={15} className="text-purple-400" /> API & MCP Docs
                </NavLink>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Hidden Developer Mode toggle — subtle, only visible on hover */}
            <button
              onClick={toggleDev}
              title={devMode ? 'Disable Developer Mode' : 'Enable Developer Mode'}
              className={`p-1 rounded transition-colors text-xs font-mono ${
                devMode
                  ? 'text-purple-500 bg-purple-50 hover:bg-purple-100'
                  : 'text-gray-200 hover:text-gray-400'
              }`}
            >
              {'</>'}
            </button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-1 rounded" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
        {devMode && (
          <div className="flex items-center gap-1.5 px-2 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs text-purple-400 font-medium">Developer Mode</span>
          </div>
        )}
      </div>
    </aside>
  );
}
