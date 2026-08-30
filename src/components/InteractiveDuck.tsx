"use client";

import { useEffect, useRef, useState } from "react";
import { DuckMark } from "./DuckMark";

// "quack" by Mari0411, CC0: https://freesound.org/people/Mari0411/sounds/791152/
export function InteractiveDuck() {
  const [isQuacking, setIsQuacking] = useState(false);
  const [isAgitated, setIsAgitated] = useState(false);
  const [isOverheated, setIsOverheated] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [soundCueId, setSoundCueId] = useState(0);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const quackAudioRef = useRef<HTMLAudioElement | null>(null);
  const stompContextRef = useRef<AudioContext | null>(null);
  const clickTimesRef = useRef<number[]>([]);
  const soundCueCountRef = useRef(0);
  const mouthTimerRef = useRef<number | null>(null);
  const agitatedTimerRef = useRef<number | null>(null);
  const stompTimerRef = useRef<number | null>(null);
  const stompFadeTimerRef = useRef<number | null>(null);
  const overheatedTimerRef = useRef<number | null>(null);
  const soundCueTimerRef = useRef<number | null>(null);
  const hoverCueRolledRef = useRef(false);
  const nextAgitatedQuackRef = useRef(0);

  useEffect(() => {
    const audio = new Audio("/audio/quack.mp3");
    audio.preload = "auto";
    audio.volume = 0.5;
    audio.preservesPitch = false;
    quackAudioRef.current = audio;

    return () => {
      if (mouthTimerRef.current !== null) window.clearTimeout(mouthTimerRef.current);
      if (agitatedTimerRef.current !== null) window.clearTimeout(agitatedTimerRef.current);
      if (stompTimerRef.current !== null) window.clearInterval(stompTimerRef.current);
      if (stompFadeTimerRef.current !== null) window.clearTimeout(stompFadeTimerRef.current);
      if (overheatedTimerRef.current !== null) window.clearTimeout(overheatedTimerRef.current);
      if (soundCueTimerRef.current !== null) window.clearTimeout(soundCueTimerRef.current);
      audio.pause();
    };
  }, []);

  function playQuack(agitated: boolean, quiet = false) {
    const now = performance.now();
    if (agitated && now < nextAgitatedQuackRef.current) return false;

    const audio = quackAudioRef.current ?? new Audio("/audio/quack.mp3");
    quackAudioRef.current = audio;
    audio.volume = agitated ? 0.74 : quiet ? 0.22 : 0.5;
    audio.playbackRate = agitated ? 1.02 + Math.pow(Math.random(), 0.72) * 0.08 : 0.96 + Math.random() * 0.08;
    audio.preservesPitch = false;
    audio.currentTime = 0;
    void audio.play();

    if (agitated) nextAgitatedQuackRef.current = now + 900;
    return true;
  }

  function triggerQuack(agitated: boolean, quiet = false) {
    if (!playQuack(agitated, quiet)) return;

    setIsQuacking(true);
    if (mouthTimerRef.current !== null) window.clearTimeout(mouthTimerRef.current);
    mouthTimerRef.current = window.setTimeout(() => setIsQuacking(false), agitated ? 560 : 420);
  }

  function handleHover() {
    if (!isAudioUnlocked || isAgitated || isQuacking || hoverCueRolledRef.current) return;

    hoverCueRolledRef.current = true;
    if (Math.random() < 0.002) triggerQuack(false, true);
  }

  function playStomp() {
    const context = stompContextRef.current ?? new AudioContext();
    stompContextRef.current = context;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(145, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.11);

    if (context.state === "suspended") void context.resume();
  }

  function handleClick() {
    setIsAudioUnlocked(true);

    if (stompFadeTimerRef.current !== null) {
      window.clearTimeout(stompFadeTimerRef.current);
      stompFadeTimerRef.current = null;
      setIsSettling(false);
    }

    if (soundCueCountRef.current < 3) {
      soundCueCountRef.current += 1;
      setSoundCueId((id) => id + 1);
      if (soundCueTimerRef.current !== null) window.clearTimeout(soundCueTimerRef.current);
      soundCueTimerRef.current = window.setTimeout(() => {
        setSoundCueId(0);
        soundCueTimerRef.current = null;
      }, 820);
    }

    const now = performance.now();
    const recentClicks = clickTimesRef.current.filter((click) => now - click < 1800);
    recentClicks.push(now);
    clickTimesRef.current = recentClicks;

    const agitated = isAgitated || recentClicks.length >= 5;
    setIsAgitated(agitated);

    if (agitated && !isOverheated && overheatedTimerRef.current === null) {
      overheatedTimerRef.current = window.setTimeout(() => {
        setIsOverheated(true);
        overheatedTimerRef.current = null;
      }, 2600);
    }

    if (agitated && stompTimerRef.current === null) {
      playStomp();
      stompTimerRef.current = window.setInterval(playStomp, 140);
    }

    triggerQuack(agitated);

    if (agitated) {
      if (agitatedTimerRef.current !== null) window.clearTimeout(agitatedTimerRef.current);
      agitatedTimerRef.current = window.setTimeout(() => {
        if (overheatedTimerRef.current !== null) {
          window.clearTimeout(overheatedTimerRef.current);
          overheatedTimerRef.current = null;
        }

        if (stompTimerRef.current !== null) {
          window.clearInterval(stompTimerRef.current);
          stompTimerRef.current = null;
        }

        setIsSettling(true);
        stompFadeTimerRef.current = window.setTimeout(() => {
          playStomp();
          stompFadeTimerRef.current = window.setTimeout(() => {
            playStomp();
            stompFadeTimerRef.current = window.setTimeout(() => {
              setIsAgitated(false);
              setIsOverheated(false);
              setIsSettling(false);
              clickTimesRef.current = [];
              nextAgitatedQuackRef.current = 0;
              stompFadeTimerRef.current = null;
            }, 140);
          }, 160);
        }, 140);
      }, 2200);
    }
  }

  return (
    <button
      type="button"
      className="hero-duck-button"
      onMouseEnter={handleHover}
      onClick={handleClick}
      aria-label={isOverheated ? "The duck's feet are cartoonishly hot" : isAgitated ? "The duck is stomping and quacking" : isQuacking ? "The duck is quacking" : "Make the duck quack"}
    >
      {soundCueId > 0 && (
        <span className="hero-sound-waves" key={soundCueId} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
      {isOverheated && (
        <span className="duck-hot-smoke" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      )}
      <DuckMark
        size={150}
        className={["hero-duck", isSettling && "duck-mark-settling"].filter(Boolean).join(" ")}
        mouthOpen={isQuacking}
        agitated={isAgitated}
        overheated={isOverheated}
      />
    </button>
  );
}
