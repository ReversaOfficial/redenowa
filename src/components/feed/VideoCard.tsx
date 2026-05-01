import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Pause,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { VideoPost } from "./useVideoFeed";

interface VideoCardProps {
  video: VideoPost;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function VideoCard({
  video,
  isActive,
  isMuted,
  onToggleMute,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [liked, setLiked] = useState(video.liked_by_me);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef(0);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
      setShowPlayIcon(false);
    } else {
      el.pause();
      setIsPlaying(false);
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 900);
    }
  }, []);

  const doLike = useCallback(async () => {
    if (!user) return;
    setLiked(true);
    setLikesCount((c) => c + 1);
    setIsLikeAnimating(true);
    setShowHeartBurst(true);
    setTimeout(() => setIsLikeAnimating(false), 700);
    setTimeout(() => setShowHeartBurst(false), 900);
    try {
      await supabase.from("likes").insert({ post_id: video.id, user_id: user.id });
      queryClient.invalidateQueries({ queryKey: ["video-feed"] });
    } catch {}
  }, [video.id, user, queryClient]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) doLike();
    } else {
      togglePlay();
    }
    lastTapRef.current = now;
  }, [liked, doLike, togglePlay]);

  const handleLike = useCallback(async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikesCount((c) => Math.max(0, c - 1));
      try {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", video.id)
          .eq("user_id", user.id);
      } catch {}
    } else {
      await doLike();
    }
    queryClient.invalidateQueries({ queryKey: ["video-feed"] });
  }, [liked, video.id, user, queryClient, doLike]);

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const profile = video.author;
  const displayName = profile.display_name || profile.handle;

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        src={video.media_url}
        className="absolute inset-0 h-full w-full object-cover"
        loop
        playsInline
        muted={isMuted}
        preload="auto"
      />

      {/* Double-tap / tap overlay */}
      <div
        className="absolute inset-0 z-10"
        onClick={(e) => {
          e.stopPropagation();
          handleTap();
        }}
      />

      {/* Heart burst animation */}
      <AnimatePresence>
        {showHeartBurst && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          >
            <Heart className="h-24 w-24 text-red-500 fill-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause icon */}
      <AnimatePresence>
        {showPlayIcon && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.7 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          >
            <div className="rounded-full bg-black/40 p-4">
              <Pause className="h-12 w-12 text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-32 z-20 flex flex-col items-center gap-5">
        {/* Avatar */}
        <Avatar className="h-11 w-11 ring-2 ring-white">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-white/20 text-white text-sm">
            {displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Like */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            className="text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
            aria-label="curtir"
          >
            <Heart
              className={`h-7 w-7 transition-transform ${liked ? "text-red-500 fill-red-500 scale-110" : ""} ${isLikeAnimating ? "animate-bounce" : ""}`}
            />
          </button>
          <span className="text-white text-xs">{formatCount(likesCount)}</span>
        </div>

        {/* Comments */}
        <div className="flex flex-col items-center gap-0.5">
          <button className="text-white" aria-label="comentários">
            <MessageCircle className="h-7 w-7" />
          </button>
          <span className="text-white text-xs">
            {formatCount(video.comments_count)}
          </span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-0.5">
          <button className="text-white" aria-label="compartilhar">
            <Share2 className="h-7 w-7" />
          </button>
        </div>

        {/* Mute */}
        <button
          className="text-white mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label="mute/unmute"
        >
          {isMuted ? (
            <VolumeX className="h-6 w-6" />
          ) : (
            <Volume2 className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-6 left-4 right-16 z-20">
        <p className="text-white font-semibold text-sm drop-shadow-lg">
          @{profile.handle}
        </p>
        {video.caption && (
          <p className="text-white/80 text-sm mt-1 line-clamp-2 drop-shadow">
            {video.caption}
          </p>
        )}
      </div>
    </div>
  );
}
