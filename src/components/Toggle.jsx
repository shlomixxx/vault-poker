/**
 * Simple on/off toggle switch used in the lobby settings.
 */
export function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={() => onToggle(!on)}
      style={{
        width: 36, height: 20, borderRadius: 10, cursor: "pointer",
        position: "relative",
        background: on ? "rgba(184,150,12,0.4)" : "rgba(255,255,255,0.1)",
        border: `1px solid ${on ? "#C5A028" : "rgba(255,255,255,0.1)"}`,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        background: on ? "#C5A028" : "#555",
        position: "absolute", top: 1,
        left: on ? 17 : 1,
        transition: "left 0.2s",
      }} />
    </div>
  );
}
