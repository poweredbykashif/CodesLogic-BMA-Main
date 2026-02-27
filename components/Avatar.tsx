import React from 'react';
import { AvatarProps } from '../types';

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  initials,
  size = 'md',
  status,
  disabled,
  loading,
  onLoad,
  onError,
  className = '',
  children
}) => {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };

  const statusColors = {
    online: 'bg-brand-success',
    offline: 'bg-gray-500',
    busy: 'bg-brand-error',
    away: 'bg-brand-warning',
  };

  const statusSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
  };

  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const MAX_RETRIES = 2;

  // Reset when src changes
  React.useEffect(() => {
    setImageLoaded(false);
    setImgError(false);
    setRetryCount(0);
  }, [src]);

  const avatarSrc = React.useMemo(() => {
    if (!src) return null;
    if (retryCount > 0) {
      // Add a cache-buster on retry
      return `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}`;
    }
    return src;
  }, [src, retryCount]);

  return (
    <div className={`relative inline-block ${disabled ? 'opacity-40 grayscale' : ''} ${className} rounded-full`}>
      <div className={`${sizes[size]} rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center overflow-hidden shadow-sm relative`}>

        {/* Initials — always visible as the base layer */}
        <span className={`absolute inset-0 flex items-center justify-center font-bold text-gray-300 uppercase leading-none transition-opacity duration-300 ${loading ? 'opacity-20' : 'opacity-100'}`}>
          {initials || '??'}
        </span>

        {/* Image — silently fades in on top of initials once loaded */}
        {avatarSrc && !imgError && (
          <img
            src={avatarSrc}
            alt={alt || initials || 'Avatar'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => {
              setImageLoaded(true);
              onLoad?.();
            }}
            onError={(e) => {
              if (retryCount < MAX_RETRIES) {
                console.warn(`Avatar load failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
                setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                }, 1000 * (retryCount + 1)); // Exponential backoffish
              } else {
                setImgError(true);
                onError?.(e);
              }
            }}
          />
        )}

        {children}
      </div>

      {status && (
        <span className={`absolute bottom-0 right-0 ${statusSizes[size]} ${statusColors[status]} rounded-full border-2 border-surface-bg z-10`} />
      )}
    </div>
  );
};
