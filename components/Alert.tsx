'use client';

import { useEffect } from 'react';

interface AlertProps {
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  onClose: () => void;
  duration?: number;
}

export default function Alert({ message, type = 'info', onClose, duration = 4000 }: AlertProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-50 border-red-300',
          text: 'text-red-800',
          icon: '❌',
          button: 'bg-red-200 hover:bg-red-300 text-red-800',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-300',
          text: 'text-yellow-800',
          icon: '⚠️',
          button: 'bg-yellow-200 hover:bg-yellow-300 text-yellow-800',
        };
      case 'success':
        return {
          bg: 'bg-green-50 border-green-300',
          text: 'text-green-800',
          icon: '✅',
          button: 'bg-green-200 hover:bg-green-300 text-green-800',
        };
      default:
        return {
          bg: 'bg-sky-50 border-sky-300',
          text: 'text-sky-800',
          icon: 'ℹ️',
          button: 'bg-sky-200 hover:bg-sky-300 text-sky-800',
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`${styles.bg} ${styles.text} border-2 rounded-xl shadow-2xl p-4 max-w-md min-w-[300px] flex items-start gap-3`}>
        <span className="text-2xl flex-shrink-0">{styles.icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onClose}
          className={`${styles.button} w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors`}
          aria-label="Close alert"
        >
          ×
        </button>
      </div>
    </div>
  );
}

