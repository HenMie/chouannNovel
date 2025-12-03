import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** 图片加载时显示的占位符 */
  placeholder?: React.ReactNode
  /** 图片加载失败时显示的内容 */
  fallback?: React.ReactNode
  /** 是否使用 IntersectionObserver 实现懒加载 */
  lazy?: boolean
  /** IntersectionObserver 的 rootMargin，控制提前加载距离 */
  rootMargin?: string
  /** 加载时的骨架屏样式 */
  skeletonClassName?: string
}

/**
 * 图片懒加载组件
 * 支持：
 * - 使用 IntersectionObserver 实现视口内加载
 * - 加载中骨架屏/占位符
 * - 加载失败回退内容
 * - 淡入动画效果
 */
export function LazyImage({
  src,
  alt,
  className,
  placeholder,
  fallback,
  lazy = true,
  rootMargin = '100px',
  skeletonClassName,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isInView, setIsInView] = useState(!lazy)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 使用 IntersectionObserver 检测元素是否进入视口
  useEffect(() => {
    if (!lazy || isInView) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, rootMargin, isInView])

  // 处理图片加载完成
  const handleLoad = () => {
    setIsLoaded(true)
    setIsError(false)
  }

  // 处理图片加载失败
  const handleError = () => {
    setIsError(true)
    setIsLoaded(false)
  }

  // 默认的骨架屏占位符
  const defaultPlaceholder = (
    <div
      className={cn(
        'animate-pulse bg-muted rounded',
        skeletonClassName
      )}
      style={{ width: props.width, height: props.height }}
    />
  )

  // 默认的失败回退内容
  const defaultFallback = (
    <div
      className={cn(
        'flex items-center justify-center bg-muted/50 text-muted-foreground text-sm rounded',
        className
      )}
      style={{ width: props.width, height: props.height }}
    >
      加载失败
    </div>
  )

  // 如果加载失败，显示回退内容
  if (isError) {
    return <>{fallback || defaultFallback}</>
  }

  return (
    <div ref={containerRef} className="relative">
      {/* 占位符：在图片未加载完成时显示 */}
      {!isLoaded && (placeholder || defaultPlaceholder)}

      {/* 图片：进入视口后才开始加载 */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
    </div>
  )
}

/**
 * 背景图片懒加载组件
 * 适用于需要作为背景的场景
 */
interface LazyBackgroundImageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 背景图片 URL */
  src: string
  /** 是否启用懒加载 */
  lazy?: boolean
  /** IntersectionObserver 的 rootMargin */
  rootMargin?: string
}

export function LazyBackgroundImage({
  src,
  lazy = true,
  rootMargin = '100px',
  className,
  children,
  style,
  ...props
}: LazyBackgroundImageProps) {
  const [isInView, setIsInView] = useState(!lazy)
  const [isLoaded, setIsLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 使用 IntersectionObserver 检测元素是否进入视口
  useEffect(() => {
    if (!lazy || isInView) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, rootMargin, isInView])

  // 预加载图片
  useEffect(() => {
    if (!isInView) return

    const img = new Image()
    img.onload = () => setIsLoaded(true)
    img.src = src
  }, [isInView, src])

  return (
    <div
      ref={containerRef}
      className={cn(
        'transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        ...style,
        backgroundImage: isInView ? `url(${src})` : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

