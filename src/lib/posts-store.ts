import { useSyncExternalStore } from "react";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import post1 from "@/assets/post-1.jpg";
import post2 from "@/assets/post-2.jpg";
import post3 from "@/assets/post-3.jpg";
import post4 from "@/assets/post-4.jpg";
import post5 from "@/assets/post-5.jpg";

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  createdAt: number; // ms epoch
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
};

const HOUR = 60 * 60 * 1000;
const now = Date.now();

const seed: Post[] = [
  {
    id: "p1",
    authorId: "u2",
    authorName: "Ana Lima",
    authorHandle: "analima",
    authorAvatar: avatar2,
    mediaUrl: post1,
    mediaType: "image",
    caption: "Café e risada — a melhor combinação ☕",
    createdAt: now - 0.5 * HOUR,
    likes: 142,
    comments: 12,
    liked: false,
    saved: false,
  },
  {
    id: "p2",
    authorId: "u3",
    authorName: "Léo Souza",
    authorHandle: "leosz",
    authorAvatar: avatar3,
    mediaUrl: post2,
    mediaType: "image",
    caption: "Tóquio acordando agora",
    createdAt: now - 2 * HOUR,
    likes: 89,
    comments: 5,
    liked: true,
    saved: false,
  },
  {
    id: "p3",
    authorId: "u4",
    authorName: "Kai Tanaka",
    authorHandle: "kai",
    authorAvatar: avatar1,
    mediaUrl: post3,
    mediaType: "image",
    caption: "Almoço sem filtro 🍝",
    createdAt: now - 5 * HOUR,
    likes: 56,
    comments: 3,
    liked: false,
    saved: true,
  },
  {
    id: "p4",
    authorId: "u3",
    authorName: "Léo Souza",
    authorHandle: "leosz",
    authorAvatar: avatar3,
    mediaUrl: post4,
    mediaType: "image",
    caption: "Tentei. Caí. Tentei de novo.",
    createdAt: now - 9 * HOUR,
    likes: 312,
    comments: 28,
    liked: false,
    saved: false,
  },
  {
    id: "p5",
    authorId: "u2",
    authorName: "Ana Lima",
    authorHandle: "analima",
    authorAvatar: avatar2,
    mediaUrl: post5,
    mediaType: "image",
    caption: "Quem viu, viu 🌅",
    createdAt: now - 18 * HOUR,
    likes: 418,
    comments: 41,
    liked: true,
    saved: true,
  },
];

// Current user
export const ME = {
  id: "u1",
  name: "Você",
  handle: "voce",
  avatar: avatar1,
};

let posts: Post[] = seed;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const postsStore = {
  getAll(): Post[] {
    return posts;
  },
  getActive(): Post[] {
    const cutoff = Date.now() - 24 * HOUR;
    return posts.filter((p) => p.createdAt > cutoff);
  },
  getArchive(authorId: string): Post[] {
    const cutoff = Date.now() - 24 * HOUR;
    return posts.filter((p) => p.authorId === authorId && p.createdAt <= cutoff);
  },
  getByAuthor(authorId: string): Post[] {
    const cutoff = Date.now() - 24 * HOUR;
    return posts.filter((p) => p.authorId === authorId && p.createdAt > cutoff);
  },
  add(p: Omit<Post, "id" | "createdAt" | "likes" | "comments" | "liked" | "saved">) {
    const post: Post = {
      ...p,
      id: `p${Date.now()}`,
      createdAt: Date.now(),
      likes: 0,
      comments: 0,
      liked: false,
      saved: false,
    };
    posts = [post, ...posts];
    emit();
    return post;
  },
  toggleLike(id: string) {
    posts = posts.map((p) =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p
    );
    emit();
  },
  toggleSave(id: string) {
    posts = posts.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p));
    emit();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useActivePosts() {
  return useSyncExternalStore(
    (cb) => postsStore.subscribe(cb),
    () => postsStore.getActive(),
    () => postsStore.getActive()
  );
}

export function useMyPosts() {
  return useSyncExternalStore(
    (cb) => postsStore.subscribe(cb),
    () => postsStore.getByAuthor(ME.id),
    () => postsStore.getByAuthor(ME.id)
  );
}

export function useMyArchive() {
  return useSyncExternalStore(
    (cb) => postsStore.subscribe(cb),
    () => postsStore.getArchive(ME.id),
    () => postsStore.getArchive(ME.id)
  );
}

export function timeRemaining(createdAt: number): string {
  const expiresAt = createdAt + 24 * HOUR;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / (60 * 1000));
  if (h >= 1) return `${h}h restantes`;
  return `${m}min restantes`;
}

export function timeAgo(createdAt: number): string {
  const ms = Date.now() - createdAt;
  const m = Math.floor(ms / (60 * 1000));
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
