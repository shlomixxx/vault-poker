import { useState } from 'react';
import { HELP } from '../helpContent.js';

/**
 * Floating "?" button that appears on every screen.
 * Pass the `screen` prop (matching a key in helpContent.js) to show the right help.
 */
export function HelpButton({ screen }) {
  const [open, setOpen] = useState(false);
  const content = HELP[screen];
  if (!content) return null;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        title="עזרה"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9000,
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg,#C5A028,#92750A)',
          border: 'none', color: '#111', fontSize: 20, fontWeight: 900,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(184,150,12,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
      >
        ?
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9001,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto',
              background: 'linear-gradient(180deg,#0D1117,#0A0F0A)',
              borderRadius: 16, border: '1px solid rgba(184,150,12,0.35)',
              boxShadow: '0 0 40px rgba(184,150,12,0.2)',
              fontFamily: "'Segoe UI',sans-serif",
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid rgba(184,150,12,0.15)',
              position: 'sticky', top: 0, background: '#0D1117', zIndex: 1,
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#E5C94B', fontFamily: 'Georgia,serif' }}>
                  ❓ {content.title}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{content.description}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: '#999', fontSize: 18, cursor: 'pointer',
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Sections */}
            <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {content.sections.map((sec, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C5A028', marginBottom: 6 }}>
                    {sec.title}
                  </div>
                  <div style={{
                    fontSize: 12, color: '#CCC', lineHeight: 1.6,
                    whiteSpace: 'pre-line', marginBottom: sec.example ? 10 : 0,
                  }}>
                    {sec.text}
                  </div>
                  {sec.example && (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: 7,
                      border: '1px solid rgba(184,150,12,0.1)',
                      padding: '8px 12px',
                    }}>
                      <div style={{ fontSize: 9, color: '#666', fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>
                        דוגמה
                      </div>
                      <div style={{ fontSize: 11, color: '#A0A', lineHeight: 1.7, whiteSpace: 'pre-line', color: '#9FC' }}>
                        {sec.example}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: 10, color: '#444', textAlign: 'center',
            }}>
              לחץ מחוץ לחלון או על × כדי לסגור
            </div>
          </div>
        </div>
      )}
    </>
  );
}
