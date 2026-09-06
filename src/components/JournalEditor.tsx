import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Tag,
  BookOpen,
  Calendar,
  MessageSquare,
  Flame,
  FileText,
  Lightbulb,
  PanelLeft,
  Trash2,
  X,
} from 'lucide-react';
import type { Interaction, ReflectionMode, ChatMessage, UserProfile } from '../types';
import { saveUserInteraction } from '../lib/firebase';
import { ErrorBanner } from './ErrorBanner';

interface JournalEditorProps {
  user: UserProfile;
  currentInteraction: Interaction | null;
  onSaveSuccess: (interaction: Interaction) => void;
  onDeleteInteraction?: (id: string) => Promise<void>;
  onToggleSidebarMobile?: () => void;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  user,
  currentInteraction,
  onSaveSuccess,
  onDeleteInteraction,
  onToggleSidebarMobile,
}) => {
  // Active interaction state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<ReflectionMode>('reflect');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');

  // Input state
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modelUsedBadge, setModelUsedBadge] = useState<string>('gemini-3.6-flash');

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  const handleConfirmEditorDelete = async () => {
    if (!activeId || !onDeleteInteraction) return;
    try {
      setIsDeleting(true);
      setDeleteModalError(null);
      await onDeleteInteraction(activeId);
      setShowDeleteModal(false);
      // Reset editor state to blank reflection
      setActiveId(null);
      setTitle('');
      setMessages([]);
      setTags([]);
      setSummary('');
      setInputText('');
    } catch (err) {
      console.error('Failed to delete reflection from editor:', err);
      setDeleteModalError(
        err instanceof Error ? err.message : 'Could not delete entry from database. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // New tag input
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // Chat scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize when currentInteraction prop changes (e.g. user clicked an entry in history)
  useEffect(() => {
    if (currentInteraction) {
      setActiveId(currentInteraction.id);
      setTitle(currentInteraction.title || 'Untitled Reflection');
      setMode(currentInteraction.mode || 'reflect');
      setMessages(currentInteraction.messages || []);
      setTags(currentInteraction.tags || []);
      setSummary(currentInteraction.summary || '');
      setErrorMessage(null);
      setSaveStatus('saved');
    } else {
      // New empty reflection
      setActiveId(null);
      setTitle('');
      setMode('reflect');
      setMessages([]);
      setTags([]);
      setSummary('');
      setInputText('');
      setErrorMessage(null);
      setSaveStatus('idle');
    }
  }, [currentInteraction]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Copy message text to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add a custom tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const sanitized = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (sanitized && !tags.includes(sanitized)) {
        const nextTags = [...tags, sanitized];
        setTags(nextTags);
        // Auto-save tag update if document exists
        if (activeId) {
          saveUserInteraction(
            user.uid,
            {
              title: title || 'Untitled Reflection',
              initialPrompt: messages[0]?.content || inputText || 'Reflection',
              mode,
              messages,
              tags: nextTags,
              summary,
              createdAt: currentInteraction?.createdAt || Date.now(),
              updatedAt: Date.now(),
            },
            activeId
          ).catch((err) => console.error('Error saving tag:', err));
        }
      }
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    if (activeId) {
      saveUserInteraction(
        user.uid,
        {
          title: title || 'Untitled Reflection',
          initialPrompt: messages[0]?.content || inputText || 'Reflection',
          mode,
          messages,
          tags: nextTags,
          summary,
          createdAt: currentInteraction?.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        activeId
      ).catch((err) => console.error('Error saving tag:', err));
    }
  };

  /**
   * Submit reflection prompt to Gemini API with guaranteed transaction persistence
   */
  const handleSendPrompt = async (forcedMode?: ReflectionMode) => {
    const activeMode = forcedMode || mode;
    const textToSend = inputText.trim();

    if (!textToSend || isProcessing) {
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now() + '-u',
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    // Optimistically show user message in conversation UI
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Save prompt reference in case of failure so user doesn't lose text
    const pendingText = textToSend;
    setInputText('');

    try {
      // 1. Call backend server endpoint
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reflectionText: pendingText,
          mode: activeMode,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with HTTP ${response.status}`);
      }

      const data = await response.json();

      const modelMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-m',
        role: 'model',
        content: data.reply || 'No response received from Gemini.',
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);
      if (data.modelUsed) setModelUsedBadge(data.modelUsed);

      // Derive title if not yet set
      const derivedTitle = title.trim()
        ? title
        : pendingText.length > 50
        ? `${pendingText.slice(0, 47)}...`
        : pendingText;
      setTitle(derivedTitle);

      const finalSummary = data.summary || summary || pendingText.slice(0, 100);
      setSummary(finalSummary);

      // Merge suggested tags with existing
      const combinedTags = Array.from(new Set([...tags, ...(data.suggestedTags || [])]));
      setTags(combinedTags);

      // 2. Guaranteed Transaction Verification: Save to Cloud Firestore
      setIsSaving(true);
      setSaveStatus('saving');

      const savedDocId = await saveUserInteraction(
        user.uid,
        {
          title: derivedTitle,
          initialPrompt: finalMessages[0]?.content || pendingText,
          summary: finalSummary,
          tags: combinedTags,
          mode: activeMode,
          messages: finalMessages,
          createdAt: currentInteraction?.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        activeId || undefined
      );

      setActiveId(savedDocId);
      setSaveStatus('saved');

      onSaveSuccess({
        id: savedDocId,
        userId: user.uid,
        title: derivedTitle,
        initialPrompt: finalMessages[0]?.content || pendingText,
        summary: finalSummary,
        tags: combinedTags,
        mode: activeMode,
        messages: finalMessages,
        createdAt: currentInteraction?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      console.error('Reflection processing or persistence failed:', err);
      // Retain the prompt in the input box so user doesn't lose their writing!
      setInputText(pendingText);
      // Remove optimistic user message to prevent UI desync
      setMessages(messages);
      setSaveStatus('error');
      setErrorMessage(
        err?.message || 'Failed to generate reflection with Gemini. Please check your connection and retry.'
      );
    } finally {
      setIsProcessing(false);
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-natural-bg text-natural-text">
      {/* Top Editor Toolbar */}
      <div className="border-b border-natural-border bg-natural-bg px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Mobile Sidebar Toggle & Title */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {onToggleSidebarMobile && (
              <button
                onClick={onToggleSidebarMobile}
                className="md:hidden p-1.5 text-natural-text-muted hover:bg-natural-surface rounded-lg cursor-pointer"
                title="Toggle History"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            )}

            <input
              id="reflection-title-input"
              type="text"
              placeholder="Title this reflection (optional)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (activeId && title.trim()) {
                  saveUserInteraction(
                    user.uid,
                    {
                      title: title.trim(),
                      initialPrompt: messages[0]?.content || 'Reflection',
                      mode,
                      messages,
                      tags,
                      summary,
                      createdAt: currentInteraction?.createdAt || Date.now(),
                      updatedAt: Date.now(),
                    },
                    activeId
                  ).catch((err) => console.error('Failed to update title:', err));
                }
              }}
              className="font-serif text-base sm:text-lg font-semibold text-natural-text placeholder-natural-text-light bg-transparent border-none focus:outline-none focus:ring-0 w-full"
            />
          </div>

          {/* Mode Selector & Status */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-natural-border bg-natural-surface p-0.5 text-xs">
              <button
                onClick={() => setMode('reflect')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  mode === 'reflect'
                    ? 'bg-natural-card font-medium text-natural-text shadow-xs border border-natural-border-subtle'
                    : 'text-natural-text-muted hover:text-natural-text'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-natural-olive" />
                <span className="hidden sm:inline">Reflect</span>
              </button>
              <button
                onClick={() => setMode('summarize')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  mode === 'summarize'
                    ? 'bg-natural-card font-medium text-natural-text shadow-xs border border-natural-border-subtle'
                    : 'text-natural-text-muted hover:text-natural-text'
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-[#5a7d52]" />
                <span className="hidden sm:inline">Summarize</span>
              </button>
              <button
                onClick={() => setMode('brainstorm')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  mode === 'brainstorm'
                    ? 'bg-natural-card font-medium text-natural-text shadow-xs border border-natural-border-subtle'
                    : 'text-natural-text-muted hover:text-natural-text'
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5 text-[#8c734b]" />
                <span className="hidden sm:inline">Brainstorm</span>
              </button>
            </div>

            {/* Model Badge */}
            <span className="hidden lg:inline-flex items-center gap-1 rounded-md bg-natural-surface border border-natural-border px-2 py-1 text-[11px] font-mono text-natural-text-muted">
              <Sparkles className="h-3 w-3 text-natural-olive" />
              {modelUsedBadge}
            </span>

            {/* Delete Reflection Button if viewing an existing entry */}
            {activeId && onDeleteInteraction && (
              <button
                id="toolbar-delete-btn"
                type="button"
                onClick={() => {
                  setDeleteModalError(null);
                  setShowDeleteModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-natural-border bg-natural-surface px-2 py-1 text-[11px] text-natural-text-muted hover:border-[#e8c2ba] hover:text-[#b84a37] transition-colors cursor-pointer"
                title="Delete reflection"
              >
                <Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Tags Bar */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-natural-text-muted">
          <Tag className="h-3.5 w-3.5 text-natural-text-light" />
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-md bg-natural-surface border border-natural-border px-2 py-0.5 text-[11px] font-medium text-natural-text"
            >
              #{t}
              <button
                onClick={() => handleRemoveTag(t)}
                className="text-natural-text-light hover:text-natural-text ml-0.5 cursor-pointer"
              >
                &times;
              </button>
            </span>
          ))}

          {showTagInput ? (
            <input
              type="text"
              placeholder="tag + Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              onBlur={() => setShowTagInput(false)}
              autoFocus
              className="w-24 rounded border border-natural-border bg-natural-card px-1.5 py-0.5 text-[11px] text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-olive"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="rounded border border-dashed border-natural-border px-1.5 py-0.5 text-[11px] text-natural-text-muted hover:border-natural-olive hover:text-natural-text cursor-pointer"
            >
              + Tag
            </button>
          )}

          {saveStatus === 'saved' && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-[#5a7d52] font-medium">
              <Check className="h-3 w-3" />
              Saved to Firestore
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-700">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Persisting...
            </span>
          )}
        </div>
      </div>

      {/* Error Banner if error occurred */}
      {errorMessage && (
        <div className="p-4 bg-natural-surface border-b border-[#e8c2ba]">
          <ErrorBanner
            message={errorMessage}
            onRetry={() => handleSendPrompt()}
            onDismiss={() => setErrorMessage(null)}
          />
        </div>
      )}

      {/* Conversation / Journal Reflection Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6 bg-natural-bg">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-natural-surface border border-natural-border text-natural-olive shadow-2xs">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-serif text-lg font-semibold text-natural-text">
              What's on your mind today?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-natural-text-muted leading-relaxed max-w-md mx-auto">
              Write a stream of consciousness, a tough decision, an emotion you are sitting with, or a milestone you achieved. Gemini 3.6 Flash will reflect, summarize, or brainstorm with you.
            </p>

            {/* Starter Prompts */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {[
                {
                  label: 'Emotional Check-in',
                  prompt: "I've been feeling overwhelmed with balancing my priorities lately...",
                  mode: 'reflect' as ReflectionMode,
                },
                {
                  label: 'Decision Making',
                  prompt: 'I am facing a fork in the road between two career paths...',
                  mode: 'brainstorm' as ReflectionMode,
                },
                {
                  label: 'Weekly Review',
                  prompt: 'Here are the key things that happened this past week that I want to unpack...',
                  mode: 'summarize' as ReflectionMode,
                },
                {
                  label: 'Creative Spark',
                  prompt: "I have a rough concept for a new creative endeavor, but I'm unsure where to start...",
                  mode: 'brainstorm' as ReflectionMode,
                },
              ].map((starter, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(starter.prompt);
                    setMode(starter.mode);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-xl border border-natural-border bg-natural-surface/80 p-3 text-left hover:bg-natural-surface hover:border-natural-border-strong transition-colors cursor-pointer shadow-2xs"
                >
                  <p className="text-xs font-semibold text-natural-text">{starter.label}</p>
                  <p className="mt-1 text-[11px] text-natural-text-muted line-clamp-1">{starter.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-natural-olive text-natural-bg mt-1 shadow-2xs">
                    <Sparkles className="h-4 w-4 text-[#f4f1ea]" />
                  </div>
                )}

                <div
                  className={`relative group rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-natural-olive text-natural-bg max-w-[85%] shadow-2xs'
                      : 'bg-natural-card border border-natural-border text-natural-text max-w-[90%] shadow-2xs'
                  }`}
                >
                  {/* Header / Timestamp */}
                  <div
                    className={`flex items-center justify-between gap-4 mb-1.5 pb-1 border-b text-[10px] ${
                      isUser
                        ? 'border-natural-bg/20 text-natural-bg/80'
                        : 'border-natural-border text-natural-text-muted'
                    }`}
                  >
                    <span className="font-semibold uppercase tracking-wider">
                      {isUser ? 'Your Journal Entry' : 'Gemini Reflection'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer ${
                          isUser ? 'hover:text-white' : 'hover:text-natural-olive'
                        }`}
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <Check className={`h-3 w-3 ${isUser ? 'text-[#e8dfc7]' : 'text-[#5a7d52]'}`} />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-neutral prose-xs sm:prose-sm max-w-none text-natural-text">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-natural-surface border border-natural-border text-natural-text text-xs font-medium mt-1">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex gap-3 max-w-3xl mr-auto justify-start animate-pulse">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-natural-olive text-natural-bg">
              <Sparkles className="h-4 w-4 text-[#f4f1ea] animate-spin" />
            </div>
            <div className="rounded-2xl border border-natural-border bg-natural-surface px-4 py-3 text-xs text-natural-text-muted flex items-center gap-2.5 shadow-2xs">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-natural-olive" />
              <span>
                Gemini 3.6 Flash is synthesizing your reflection ({mode} mode)...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="border-t border-natural-border bg-natural-bg p-3 sm:p-4">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-2xl border border-natural-border-strong bg-natural-card p-2 focus-within:border-natural-olive focus-within:ring-1 focus-within:ring-natural-olive transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              id="reflection-input"
              rows={3}
              placeholder={
                mode === 'reflect'
                  ? 'Pour your thoughts, challenges, or gratitude here... (Cmd/Ctrl + Enter to send)'
                  : mode === 'summarize'
                  ? 'Paste your detailed journal notes or reflection to generate an executive synthesis...'
                  : 'Describe a situation, goal, or creative block to brainstorm new perspectives...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              className="w-full resize-none border-none bg-transparent px-2 py-1 text-xs sm:text-sm text-natural-text placeholder-natural-text-light focus:outline-none focus:ring-0 leading-relaxed"
            />

            <div className="flex items-center justify-between border-t border-natural-border-subtle pt-2 px-1">
              <div className="flex items-center gap-2 text-[11px] text-natural-text-muted">
                <span>{inputText.length} chars</span>
                <span className="hidden sm:inline">&bull; Press Cmd/Ctrl + Enter</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="submit-reflection-btn"
                  onClick={() => handleSendPrompt()}
                  disabled={!inputText.trim() || isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-natural-olive px-4 py-2 text-xs font-medium text-natural-bg hover:bg-natural-olive-hover transition-all focus:outline-none focus:ring-2 focus:ring-natural-olive/40 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Reflecting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-[#f4f1ea]" />
                      <span>Send to Gemini</span>
                      <Send className="h-3 w-3 ml-0.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          id="editor-delete-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
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
                onClick={() => !isDeleting && setShowDeleteModal(false)}
                className="p-1 text-natural-text-light hover:text-natural-text rounded cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="font-serif text-base font-semibold text-natural-text">
              Delete This Reflection?
            </h3>
            <p className="mt-1.5 text-xs text-natural-text-muted leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-natural-text">
                "{title || currentInteraction?.title || 'Untitled Reflection'}"
              </span>
              ? This conversation and reflection history will be permanently deleted from Firestore.
            </p>

            {deleteModalError && (
              <div className="mt-3 rounded-lg border border-[#e8c2ba] bg-[#faf2f0] p-2.5 text-[11px] text-[#8a3324]">
                {deleteModalError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                id="cancel-editor-delete-btn"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="rounded-xl border border-natural-border bg-natural-surface px-3.5 py-2 text-xs font-medium text-natural-text hover:bg-natural-surface-alt transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-editor-delete-btn"
                onClick={handleConfirmEditorDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#b84a37] px-4 py-2 text-xs font-medium text-[#fdfcf8] hover:bg-[#a13f2e] transition-colors focus:outline-none focus:ring-2 focus:ring-[#b84a37]/40 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isDeleting ? (
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
};
