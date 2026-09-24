"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_ANSWER_COUNT,
  MAX_ANSWER_COUNT,
  MAX_N,
  MIN_ANSWER_COUNT,
  MIN_N,
  PREVIEW_MS,
  SPEED_MS,
  Speed,
  accuracyPercent,
  formatProblem,
  generateProblems,
  type Problem,
} from "@/lib/game";

type Phase = "setup" | "preview" | "playing" | "result";

type RoundResult = {
  n: number;
  answerCount: number;
  speed: Speed;
  correct: number;
  total: number;
  timedOut: number;
};

export default function OniCalc() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [n, setN] = useState(2);
  const [answerCount, setAnswerCount] = useState(DEFAULT_ANSWER_COUNT);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [timedOut, setTimedOut] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "ok" | "ng">("idle");
  const [timeLeft, setTimeLeft] = useState(1);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundId, setRoundId] = useState(0);

  const nRef = useRef(n);
  const answerCountRef = useRef(answerCount);
  const speedRef = useRef(speed);
  const phaseRef = useRef(phase);
  const indexRef = useRef(index);
  const correctRef = useRef(correct);
  const answeredRef = useRef(answered);
  const timedOutRef = useRef(timedOut);
  const feedbackRef = useRef(feedback);
  const problemsRef = useRef(problems);
  const advancingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);

  useEffect(() => {
    nRef.current = n;
  }, [n]);
  useEffect(() => {
    answerCountRef.current = answerCount;
  }, [answerCount]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);
  useEffect(() => {
    answeredRef.current = answered;
  }, [answered]);
  useEffect(() => {
    timedOutRef.current = timedOut;
  }, [timedOut]);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
  useEffect(() => {
    problemsRef.current = problems;
  }, [problems]);

  const maxNForCount = Math.min(MAX_N, answerCount);

  const clampAnswerCount = (v: number) =>
    Math.min(MAX_ANSWER_COUNT, Math.max(MIN_ANSWER_COUNT, Math.floor(v)));

  const applyAnswerCount = (next: number) => {
    const clamped = clampAnswerCount(next);
    setAnswerCount(clamped);
    setN((prev) => Math.min(prev, Math.min(MAX_N, clamped)));
  };

  const stopTimer = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finish = useCallback(
    (finalCorrect: number, finalAnswered: number, finalTimedOut: number) => {
      stopTimer();
      setResult({
        n: nRef.current,
        answerCount: answerCountRef.current,
        speed: speedRef.current,
        correct: finalCorrect,
        total: finalAnswered,
        timedOut: finalTimedOut,
      });
      setPhase("result");
    },
    [stopTimer],
  );

  const advance = useCallback(
    (opts?: { markCorrect?: boolean; markTimeout?: boolean }) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      stopTimer();

      const currentPhase = phaseRef.current;
      const currentIndex = indexRef.current;
      const currentN = nRef.current;
      const currentAnswerCount = answerCountRef.current;
      let nextCorrect = correctRef.current;
      let nextAnswered = answeredRef.current;
      let nextTimedOut = timedOutRef.current;

      if (currentPhase === "playing") {
        nextAnswered += 1;
        if (opts?.markCorrect) nextCorrect += 1;
        if (opts?.markTimeout) nextTimedOut += 1;
        setCorrect(nextCorrect);
        setAnswered(nextAnswered);
        setTimedOut(nextTimedOut);
      }

      const nextIndex = currentIndex + 1;
      const endIndex = currentAnswerCount + currentN;

      if (nextIndex >= endIndex) {
        finish(nextCorrect, nextAnswered, nextTimedOut);
        return;
      }

      const nextPhase =
        currentPhase === "preview" && nextIndex >= currentN
          ? "playing"
          : currentPhase === "playing"
            ? "playing"
            : "preview";

      setIndex(nextIndex);
      setFeedback("idle");
      setPhase(nextPhase);
      setRoundId((id) => id + 1);
      advancingRef.current = false;
    },
    [finish, stopTimer],
  );

  const startRound = useCallback(() => {
    stopTimer();
    advancingRef.current = false;
    // Only answerCount problems are ever answered / need memorizing.
    // The final N answer steps show no new formula.
    const count = answerCountRef.current;
    const list = generateProblems(count);
    setProblems(list);
    setIndex(0);
    setCorrect(0);
    setAnswered(0);
    setTimedOut(0);
    setFeedback("idle");
    setTimeLeft(1);
    setResult(null);
    setPhase("preview");
    setRoundId((id) => id + 1);
  }, [stopTimer]);

  const submitAnswer = useCallback(
    (digit: number) => {
      if (
        phaseRef.current !== "playing" ||
        advancingRef.current ||
        feedbackRef.current !== "idle"
      ) {
        return;
      }

      const currentIndex = indexRef.current;
      const expected =
        problemsRef.current[currentIndex - nRef.current]?.answer;
      const ok = digit === expected;
      setFeedback(ok ? "ok" : "ng");
      stopTimer();

      window.setTimeout(() => {
        advance({ markCorrect: ok });
      }, ok ? 180 : 320);
    },
    [advance, stopTimer],
  );

  // Per-step timer — restarts only when roundId changes
  useEffect(() => {
    if (phase !== "preview" && phase !== "playing") return;
    if (problems.length === 0) return;

    advancingRef.current = false;
    const duration =
      phase === "preview"
        ? PREVIEW_MS[speedRef.current]
        : SPEED_MS[speedRef.current];
    deadlineRef.current = performance.now() + duration;
    setTimeLeft(1);

    const tick = (now: number) => {
      const left = Math.max(0, (deadlineRef.current - now) / duration);
      setTimeLeft(left);
      if (left <= 0) {
        if (phaseRef.current === "preview") {
          advance();
        } else if (
          phaseRef.current === "playing" &&
          feedbackRef.current === "idle"
        ) {
          setFeedback("ng");
          stopTimer();
          window.setTimeout(() => {
            advance({ markTimeout: true });
          }, 280);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => stopTimer();
  }, [phase, roundId, problems.length, advance, stopTimer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        submitAnswer(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitAnswer]);

  const current = problems[index];
  // Last N answer steps: formula is past the set — answer-only, nothing new to memorize.
  const answerOnly = phase === "playing" && index >= answerCount;
  const progressDone =
    phase === "preview" ? index : phase === "playing" ? answered : answerCount;
  const progressTotal = phase === "preview" ? n : answerCount;

  return (
    <div className="shell">
      <header className="brand">
        <p className="brand-mark">鬼計算</p>
        <p className="brand-sub">Nバック計算トレーニング</p>
      </header>

      {phase === "setup" && (
        <section className="panel setup" aria-label="設定">
          <label className="field">
            <span className="field-label">バック数</span>
            <div className="n-row">
              <button
                type="button"
                className="step"
                onClick={() => setN((v) => Math.max(MIN_N, v - 1))}
                aria-label="バック数を減らす"
              >
                −
              </button>
              <input
                className="n-input"
                type="number"
                min={MIN_N}
                max={maxNForCount}
                value={n}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isNaN(v)) return;
                  setN(
                    Math.min(maxNForCount, Math.max(MIN_N, Math.floor(v))),
                  );
                }}
              />
              <button
                type="button"
                className="step"
                onClick={() => setN((v) => Math.min(maxNForCount, v + 1))}
                aria-label="バック数を増やす"
              >
                ＋
              </button>
            </div>
            <span className="field-hint">
              {n}問前の答えを入力します（{MIN_N}〜{maxNForCount}）
            </span>
          </label>

          <label className="field">
            <span className="field-label">問題数</span>
            <div className="n-row">
              <button
                type="button"
                className="step"
                onClick={() => applyAnswerCount(answerCount - 1)}
                aria-label="問題数を減らす"
              >
                −
              </button>
              <input
                className="n-input"
                type="number"
                min={MIN_ANSWER_COUNT}
                max={MAX_ANSWER_COUNT}
                value={answerCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isNaN(v)) return;
                  applyAnswerCount(v);
                }}
              />
              <button
                type="button"
                className="step"
                onClick={() => applyAnswerCount(answerCount + 1)}
                aria-label="問題数を増やす"
              >
                ＋
              </button>
            </div>
            <span className="field-hint">
              解答する問題数（{MIN_ANSWER_COUNT}〜{MAX_ANSWER_COUNT}）
            </span>
          </label>

          <fieldset className="field">
            <legend className="field-label">速さ</legend>
            <div className="seg">
              <button
                type="button"
                className={speed === "normal" ? "seg-btn on" : "seg-btn"}
                onClick={() => setSpeed("normal")}
              >
                ゆっくり
              </button>
              <button
                type="button"
                className={speed === "fast" ? "seg-btn on" : "seg-btn"}
                onClick={() => setSpeed("fast")}
              >
                速い
              </button>
            </div>
          </fieldset>

          <p className="rules">
            式を解いて答えを覚え、画面の式ではなく
            <strong>{n}問前</strong>
            の答えをテンキーで入力してください。全{answerCount}
            問。データは保存しません。
          </p>

          <button type="button" className="cta" onClick={startRound}>
            はじめる
          </button>
        </section>
      )}

      {(phase === "preview" || phase === "playing") &&
        (current || answerOnly) && (
          <section
            className={`panel play feedback-${feedback}`}
            aria-live="polite"
          >
            <div className="meta">
              <span>
                {n}バック · {answerCount}問 ·{" "}
                {speed === "fast" ? "速い" : "ゆっくり"}
              </span>
              <span>
                {phase === "preview"
                  ? `記憶 ${index + 1}/${n}`
                  : `解答 ${Math.min(answered + 1, answerCount)}/${answerCount}`}
              </span>
            </div>

            <div className="timer-track" aria-hidden>
              <div
                className="timer-fill"
                style={{ transform: `scaleX(${timeLeft})` }}
              />
            </div>

            {phase === "preview" ? (
              <p className="mode-chip">覚えるだけ（まだ答えない）</p>
            ) : answerOnly ? (
              <p className="mode-chip ask">残りは解答のみ（新規の式なし）</p>
            ) : (
              <p className="mode-chip ask">{n}問前の答えを入力</p>
            )}

            {answerOnly ? (
              <div
                className="formula answer-only"
                key={`${phase}-${index}-${roundId}`}
              >
                <span className="eq">{n}問前の答えは？</span>
              </div>
            ) : current ? (
              <div className="formula" key={`${phase}-${index}-${roundId}`}>
                <span className="eq">{formatProblem(current)}</span>
                <span className="eq-tail">＝ ?</span>
              </div>
            ) : null}

            {phase === "playing" ? (
              <div className="pad" role="group" aria-label="数字キー">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="pad-key"
                    onClick={() => submitAnswer(d)}
                    disabled={feedback !== "idle"}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className="pad-key pad-zero"
                  onClick={() => submitAnswer(0)}
                  disabled={feedback !== "idle"}
                >
                  0
                </button>
              </div>
            ) : (
              <p className="preview-note">式と答えを頭に入れてください</p>
            )}

            <div className="progress" aria-hidden>
              <div
                className="progress-fill"
                style={{
                  width: `${(progressDone / Math.max(1, progressTotal)) * 100}%`,
                }}
              />
            </div>
          </section>
        )}

      {phase === "result" && result && (
        <section className="panel result" aria-label="結果">
          <p className="result-kicker">結果</p>
          <p className="result-score">
            {accuracyPercent(result.correct, result.total)}
            <span>%</span>
          </p>
          <ul className="result-list">
            <li>
              <span>モード</span>
              <strong>
                {result.n}バック · {result.answerCount}問 ·{" "}
                {result.speed === "fast" ? "速い" : "ゆっくり"}
              </strong>
            </li>
            <li>
              <span>正解</span>
              <strong>
                {result.correct} / {result.total}
              </strong>
            </li>
            <li>
              <span>時間切れ</span>
              <strong>{result.timedOut}</strong>
            </li>
          </ul>
          <div className="result-actions">
            <button type="button" className="cta" onClick={startRound}>
              同じ設定でもう一度
            </button>
            <button
              type="button"
              className="cta ghost"
              onClick={() => {
                stopTimer();
                setPhase("setup");
              }}
            >
              設定を変える
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
