import { useRef, useState, useEffect, useCallback } from "react";
import { useVideoFeed } from "./useVideoFeed";
import { VideoCard } from "./VideoCard";
import { Loader2, Sparkles } from "lucide-react";

export default function VideoFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useVideoFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const videos = data?.pages.flatMap((p) => p.videos) ?? [];

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            const idx = cardRefs.current.findIndex((r) => r === entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { root: containerRef.current, threshold: 0.7 },
    );
    cardRefs.current.forEach((ref) => {
      if (ref) observerRef.current?.observe(ref);
    });
    return () => observerRef.current?.disconnect();
  }, [videos.length]);

  useEffect(() => {
    if (
      activeIndex >= videos.length - 2 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [activeIndex, videos.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setCardRef = useCallback(
    (el: HTMLDivElement | null, index: number) => {
      cardRefs.current[index] = el;
      if (el && observerRef.current) observerRef.current.observe(el);
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-black gap-4">
        <p className="text-white">Erro ao carregar o feed</p>
        <button
          className="rounded-full bg-white/10 px-6 py-2 text-white text-sm"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-black px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Sparkles className="h-7 w-7 text-primary" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold text-white">Nenhum vídeo ainda</h2>
        <p className="mt-2 text-sm text-white/70">Seja o primeiro a postar!</p>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {videos.map((video, index) => (
          <div
            key={video.id}
            ref={(el) => setCardRef(el, index)}
            style={{
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
              height: "100dvh",
              width: "100%",
              position: "relative",
            }}
          >
            <VideoCard
              video={video}
              isActive={index === activeIndex}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
            />
          </div>
        ))}
      </div>

      {isFetchingNextPage && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      )}

      {!hasNextPage && videos.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <p className="text-white/40 text-xs">Você viu tudo por hoje ✨</p>
        </div>
      )}
    </div>
  );
}
