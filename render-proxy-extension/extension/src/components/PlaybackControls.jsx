import React from "react";

export function PlaybackControls({
  step,
  total,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSliderChange,
  icons
}) {
  const hasEvents = total > 0;
  const currentLabel = hasEvents ? step + 1 : 0;

  return (
    <footer className="playback">
      <div className="transport">
        <button className="icon-button" title="Previous step" disabled={!hasEvents || step === 0} onClick={onPrevious}>
          {icons.previous}
        </button>
        <button className="primary-button" disabled={!hasEvents} onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? icons.pause : icons.play}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>
        <button
          className="icon-button"
          title="Next step"
          disabled={!hasEvents || step >= total - 1}
          onClick={onNext}
        >
          {icons.next}
        </button>
      </div>

      <input
        aria-label="Timeline"
        className="timeline"
        type="range"
        min="0"
        max={Math.max(total - 1, 0)}
        value={Math.min(step, Math.max(total - 1, 0))}
        disabled={!hasEvents}
        onChange={(event) => onSliderChange(Number(event.target.value))}
      />

      <div className="step-count">
        {currentLabel} / {total}
      </div>
    </footer>
  );
}
