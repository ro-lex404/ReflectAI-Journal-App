import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Clock,
  Tag,
  BookOpen,
  Filter,
  Sparkles,
  ChevronRight,
  RefreshCw,
  X,
  MapPin,
} from 'lucide-react';
import type { Interaction, ReflectionMode } from '../types';

interface HistorySidebarProps {
  interactions: Interaction[];
  selectedId: string | null;
  onSelectInteraction: (interaction: Interaction) => void;
  onNewInteraction: () => void;
  onDeleteInteraction: (id: string) => Promise<void>;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  interactions,
  selectedId,
  onSelectInteraction,
  onNewInteraction,
  onDeleteInteraction,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | ReflectionMode>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Interaction | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Filtered interactions
  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      // Filter by mode
      if (modeFilter !== 'all' && item.mode !== modeFilter) {
        return false;
      }
      // Filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = item.title?.toLowerCase().includes(q);
      const inPrompt = item.initialPrompt?.toLowerCase().includes(q);
      const inSummary = item.summary?.toLowerCase().includes(q);
      const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      const inMessages = item.messages?.some((m) => m.content.toLowerCase().includes(q));
      return inTitle || inPrompt || inSummary || inTags || inMessages;
    });
  }, [interactions, searchQuery, modeFilter]);

  const handleDeleteClick = (e: React.MouseEvent, item: Interaction) => {
    e.stopPropagation();
    setDeleteErrorMessage(null);
    setItemToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setDeletingId(itemToDelete.id);
      setDeleteErrorMessage(null);
      await onDeleteInteraction(itemToDelete.id);
      setItemToDelete(null);
    } catch (err) {
      console.error('Failed to delete reflection:', err);
      setDeleteErrorMessage(
        err instanceof Error ? err.message : 'Could not delete entry from database. Please try again.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setItemToDelete(null);
    setDeleteErrorMessage(null);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24 && now.getDate() === date.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const content = (
    <div className="flex h-full flex-col bg-natural-surface border-r border-natural-border text-natural-text">
      {/* Top Header & New Button */}
      <div className="p-4 border-b border-natural-border bg-natural-bg">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-natural-olive" />
            <span className="font-serif text-sm font-semibold text-natural-text">
              Journal Entries
            </span>
            <span className="rounded-full bg-natural-surface border border-natural-border px-2 py-0.5 text-[11px] font-medium text-natural-text-muted">
              {interactions.length}
            </span>
          </div>

          <button
            id="new-reflection-btn"
            onClick={() => {
              onNewInteraction();
              if (onCloseMobile) onCloseMobile();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-natural-olive px-3 py-1.5 text-xs font-medium text-natural-bg hover:bg-natural-olive-hover transition-colors focus:outline-none focus:ring-2 focus:ring-natural-olive/40 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Reflection</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-natural-text-light" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Search entries, keywords, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-natural-border bg-natural-bg pl-8 pr-3 py-1.5 text-xs text-natural-text placeholder-natural-text-light focus:border-natural-olive focus:bg-white focus:outline-none focus:ring-1 focus:ring-natural-olive transition-colors"
          />
        </div>

        {/* Mode Filter Pills */}
        <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
          {(['all', 'reflect', 'summarize', 'brainstorm'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setModeFilter(mode)}
              className={`rounded-md px-2 py-0.5 capitalize transition-colors whitespace-nowrap cursor-pointer border ${
                modeFilter === mode
                  ? 'bg-natural-olive text-natural-bg border-natural-olive font-medium'
                  : 'bg-natural-surface text-natural-text-muted hover:bg-natural-surface-alt border-natural-border'
              }`}
            >
              {mode === 'all' ? 'All' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Interaction List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredInteractions.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-natural-text-light/50" />
            <p className="mt-2 text-xs font-medium text-natural-text-muted">No reflections found</p>
            <p className="mt-1 text-[11px] text-natural-text-light">
              {searchQuery ? 'Try adjusting your search query' : 'Start your first journal reflection with Gemini!'}
            </p>
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div
                key={item.id}
                id={`history-item-${item.id}`}
                onClick={() => {
                  onSelectInteraction(item);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`group relative flex flex-col gap-1.5 rounded-xl p-3 text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-natural-card border-natural-olive shadow-xs ring-1 ring-natural-olive/20'
                    : 'bg-natural-card/70 hover:bg-natural-card border-natural-border hover:border-natural-border-strong'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-xs text-natural-text line-clamp-1">
                    {item.title || 'Untitled Reflection'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-natural-text-light flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(item.updatedAt || item.createdAt)}
                    </span>
                    <button
                      id={`delete-btn-${item.id}`}
                      onClick={(e) => handleDeleteClick(e, item)}
                      disabled={deletingId === item.id}
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-natural-text-light hover:text-[#b84a37] transition-opacity rounded cursor-pointer"
                      title="Delete reflection"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Excerpt / Summary */}
                <p className="text-[11px] text-natural-text-muted line-clamp-2 leading-relaxed">
                  {item.summary || item.draftInput || item.initialPrompt || 'No excerpt available.'}
                </p>

                {/* Tags, Mode & Location Badges */}
                <div className="flex items-center justify-between gap-1 pt-1 mt-0.5 border-t border-natural-border-subtle">
                  <div className="flex items-center gap-1 overflow-hidden">
                    {(!item.messages || item.messages.length === 0) && (
                      <span className="inline-flex items-center rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Draft
                      </span>
                    )}
                    <span className="inline-flex items-center rounded bg-natural-surface border border-natural-border px-1.5 py-0.5 text-[10px] font-medium text-natural-text-muted capitalize">
                      {item.mode || 'reflect'}
                    </span>
                    {item.location && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded bg-[#eef1e6] border border-[#d6dec7] px-1.5 py-0.5 text-[10px] font-medium text-natural-olive truncate max-w-[95px]"
                        title={item.location.name || item.location.address || `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}`}
                      >
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{item.location.name || item.location.address || `${item.location.latitude.toFixed(2)}°`}</span>
                      </span>
                    )}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1 overflow-hidden">
                      {item.tags.slice(0, 2).map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-natural-surface border border-natural-border px-1.5 py-0.5 text-[10px] text-natural-text-muted"
                        >
                          #{t}
                        </span>
                      ))}
                      {item.tags.length > 2 && (
                        <span className="text-[10px] text-natural-text-light">+{item.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {itemToDelete && (
        <div
          id="delete-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={handleCancelDelete}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-natural-border bg-natural-card p-5 shadow-xl text-natural-text animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf2f0] border border-[#e8c2ba] text-[#b84a37]">
                <Trash2 className="h-5 w-5" />
              </div>
              <button
                onClick={handleCancelDelete}
                className="p-1 text-natural-text-light hover:text-natural-text rounded cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="font-serif text-base font-semibold text-natural-text">
              Delete Reflection?
            </h3>
            <p className="mt-1.5 text-xs text-natural-text-muted leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-natural-text">
                "{itemToDelete.title || 'Untitled Reflection'}"
              </span>
              ? This will permanently remove the conversation and all reflections from Firestore.
            </p>

            {deleteErrorMessage && (
              <div className="mt-3 rounded-lg border border-[#e8c2ba] bg-[#faf2f0] p-2.5 text-[11px] text-[#8a3324]">
                {deleteErrorMessage}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                id="cancel-delete-btn"
                onClick={handleCancelDelete}
                disabled={deletingId === itemToDelete.id}
                className="rounded-xl border border-natural-border bg-natural-surface px-3.5 py-2 text-xs font-medium text-natural-text hover:bg-natural-surface-alt transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-btn"
                onClick={handleConfirmDelete}
                disabled={deletingId === itemToDelete.id}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#b84a37] px-4 py-2 text-xs font-medium text-[#fdfcf8] hover:bg-[#a13f2e] transition-colors focus:outline-none focus:ring-2 focus:ring-[#b84a37]/40 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {deletingId === itemToDelete.id ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Reflection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-80 lg:w-96 shrink-0 h-[calc(100vh-4rem)]">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-natural-text/30 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[85vw] h-full shadow-xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
