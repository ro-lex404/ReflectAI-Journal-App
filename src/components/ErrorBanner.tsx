import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  onDismiss,
  isRetrying = false,
}) => {
  return (
    <div className="rounded-xl border border-[#e8c2ba] bg-[#faf2f0] p-4 text-xs text-[#8a3324] shadow-xs animate-in fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-[#b84a37] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#66251a]">Action Failed</p>
            <p className="mt-0.5 text-[#8a3324] leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#b84a37] px-3 py-1.5 text-xs font-medium text-[#fdfcf8] hover:bg-[#a13f2e] transition-colors focus:outline-none focus:ring-2 focus:ring-[#b84a37]/40 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-[#b84a37] hover:text-[#66251a] transition-colors rounded cursor-pointer"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
