"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

// "single quack from a duck" by Mikes-MultiMedia, CC0: https://freesound.org/people/Mikes-MultiMedia/sounds/418509/
function playActionQuack() {
  const audio = new Audio("/audio/action-quack.mp3");
  audio.volume = 0.24;
  audio.playbackRate = 1.05 + Math.random() * 0.08;
  audio.preservesPitch = false;
  void audio.play();
}

interface QuackAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

export function QuackAnchor({ onClick, children, ...props }: QuackAnchorProps) {
  return (
    <a {...props} onClick={(event) => { playActionQuack(); onClick?.(event); }}>
      {children}
    </a>
  );
}

interface QuackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function QuackButton({ onClick, children, ...props }: QuackButtonProps) {
  return (
    <button {...props} onClick={(event) => { playActionQuack(); onClick?.(event); }}>
      {children}
    </button>
  );
}
