"use client";

import { useEffect, useRef, useState } from "react";
import { DuckMark, type DuckMouth } from "./DuckMark";

// "quack" by Mari0411, CC0: https://freesound.org/people/Mari0411/sounds/791152/
export function InteractiveDuck() {
  const [isQuacking, setIsQuacking] = useState(false);
  const [isAgitated, setIsAgitated] = useState(false);
  const [isOverheated, setIsOverheated] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [passiveMouth, setPassiveMouth] = useState<DuckMouth>("closed");
  const [soundCueId, setSoundCueId] = useState(0);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const quackAudioRef = useRef<HTMLAudioElement | null>(null);
  const actionQuackAudioRef = useRef<HTMLAudioElement | null>(null);
  const stompContextRef = useRef<AudioContext | null>(null);
  const clickTimesRef = useRef<number[]>([]);
  const soundCueCountRef = useRef(0);
  const mouthTimerRef = useRef<number | null>(null);
  const agitatedTimerRef = useRef<number | null>(null);
  const stompTimerRef = useRef<number | null>(null);
  const stompFadeTimerRef = useRef<number | null>(null);
  const soundCueTimerRef = useRef<number | null>(null);
  const passiveOpenTimerRef = useRef<number | null>(null);
  const passiveCloseTimerRef = useRef<number | null>(null);
  const hoverCueRolledRef = useRef(false);
  const passiveHoverBoostRef = useRef(false);
  const passiveHoverBoostUntilRef = useRef(0);
  const angryQuackCountRef = useRef(0);
  const nextAgitatedQuackRef = useRef(0);

  useEffect(() => {
    const audio = new Audio("/audio/quack.mp3");
    audio.preload = "auto";
    audio.volume = 0.5;
    audio.preservesPitch = false;
    quackAudioRef.current = audio;

    const actionAudio = new Audio("/audio/action-quack.mp3");
    actionAudio.preload = "auto";
    actionAudio.volume = 0.56;
    actionAudio.preservesPitch = false;
    actionQuackAudioRef.current = actionAudio;

    return () => {
      if (mouthTimerRef.current !== null) window.clearTimeout(mouthTimerRef.current);
      if (agitatedTimerRef.current !== null) window.clearTimeout(agitatedTimerRef.current);
      if (stompTimerRef.current !== null) window.clearInterval(stompTimerRef.current);
      if (stompFadeTimerRef.current !== null) window.clearTimeout(stompFadeTimerRef.current);
      if (soundCueTimerRef.current !== null) window.clearTimeout(soundCueTimerRef.current);
      if (passiveOpenTimerRef.current !== null) window.clearTimeout(passiveOpenTimerRef.current);
      if (passiveCloseTimerRef.current !== null) window.clearTimeout(passiveCloseTimerRef.current);
      audio.pause();
      actionAudio.pause();
    };
  }, []);

  useEffect(() => {
    if (isAgitated || isQuacking || passiveMouth !== "closed") return;

    passiveOpenTimerRef.current = window.setTimeout(() => {
      passiveOpenTimerRef.current = null;
      const nextMouth: DuckMouth = Math.random() < 0.82 ? "slightly-open" : "open";

      setPassiveMouth(nextMouth);
      passiveHoverBoostRef.current = true;
      passiveHoverBoostUntilRef.current = performance.now() + 2200;
      passiveCloseTimerRef.current = window.setTimeout(() => {
        passiveCloseTimerRef.current = null;
        setPassiveMouth("closed");
      }, nextMouth === "slightly-open" ? 720 : 900);
    }, 9000 + Math.random() * 9000);

    return () => {
      if (passiveOpenTimerRef.current !== null) {
        window.clearTimeout(passiveOpenTimerRef.current);
        passiveOpenTimerRef.current = null;
      }
    };
  }, [isAgitated, isQuacking, passiveMouth]);

  function playQuack(agitated: boolean, quiet = false, sound: "real" | "action" = "real") {
    const now = performance.now();
    if (agitated && now < nextAgitatedQuackRef.current) return false;

    const audio = sound === "action"
      ? actionQuackAudioRef.current ?? new Audio("/audio/action-quack.mp3")
      : quackAudioRef.current ?? new Audio("/audio/quack.mp3");

    if (sound === "action") {
      actionQuackAudioRef.current = audio;
      audio.volume = 0.56;
      audio.playbackRate = 1.05 + Math.random() * 0.08;
    } else {
      quackAudioRef.current = audio;
      audio.volume = agitated ? 0.74 : quiet ? 0.22 : 0.5;
      audio.playbackRate = agitated ? 1.02 + Math.pow(Math.random(), 0.72) * 0.08 : 0.96 + Math.random() * 0.08;
    }

    audio.preservesPitch = false;
    audio.currentTime = 0;
    void audio.play();

    if (agitated) nextAgitatedQuackRef.current = now + 900;
    return true;
  }

  function triggerQuack(agitated: boolean, quiet = false, sound: "real" | "action" = "real") {
    if (!playQuack(agitated, quiet, sound)) return false;

    setIsQuacking(true);
    if (mouthTimerRef.current !== null) window.clearTimeout(mouthTimerRef.current);
    mouthTimerRef.current = window.setTimeout(() => setIsQuacking(false), agitated ? 560 : 420);
    return true;
  }

  function handleHover() {
    if (!isAudioUnlocked || isAgitated || isQuacking) return;

    const now = performance.now();
    if (passiveHoverBoostRef.current) {
      passiveHoverBoostRef.current = false;
      if (now < passiveHoverBoostUntilRef.current) {
        if (Math.random() < 0.05) triggerQuack(false, true, "action");
        return;
      }
    }

    if (hoverCueRolledRef.current) return;

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

    const wasAgitated = isAgitated;
    const agitated = wasAgitated || recentClicks.length >= 5;
    if (agitated && !wasAgitated) angryQuackCountRef.current = 0;
    setIsAgitated(agitated);

    if (agitated && stompTimerRef.current === null) {
      playStomp();
      stompTimerRef.current = window.setInterval(playStomp, 140);
    }

    const angryQuackPlayed = triggerQuack(agitated);
    if (agitated && wasAgitated && angryQuackPlayed) {
      angryQuackCountRef.current += 1;
      if (angryQuackCountRef.current >= 2) setIsOverheated(true);
    }

    if (agitated) {
      if (agitatedTimerRef.current !== null) window.clearTimeout(agitatedTimerRef.current);
      agitatedTimerRef.current = window.setTimeout(() => {
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
              angryQuackCountRef.current = 0;
              nextAgitatedQuackRef.current = 0;
              stompFadeTimerRef.current = null;
            }, 140);
          }, 160);
        }, 140);
      }, 1800);
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
        <svg className="duck-hot-smoke" viewBox="0 0 150 150" aria-hidden="true">
          <path className="duck-hot-wisp duck-hot-wisp-left" d="M53 130 C46 123 61 117 53 110 C47 104 58 97 55 89" />
          <path className="duck-hot-wisp duck-hot-wisp-center" d="M75 129 C68 121 82 116 75 108 C69 101 80 96 77 87" />
          <path className="duck-hot-wisp duck-hot-wisp-right" d="M98 130 C106 123 91 117 99 109 C105 103 95 97 100 89" />
        </svg>
      )}
      <DuckMark
        size={150}
        className={["hero-duck", isSettling && "duck-mark-settling"].filter(Boolean).join(" ")}
        mouth={isQuacking ? "open" : passiveMouth}
        agitated={isAgitated}
        overheated={isOverheated}
      />
    </button>
  );
}
