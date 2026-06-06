'use client'

import React, { useState, useRef, useCallback } from 'react'

interface AnalogueTimePickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function AnalogueTimePicker({ value, onChange, disabled }: AnalogueTimePickerProps) {
  const [mode, setMode] = useState<'hour' | 'minute'>('hour')
  const [editingHour, setEditingHour] = useState(false)
  const [editingMin, setEditingMin] = useState(false)
  const [hourInput, setHourInput] = useState('')
  const [minInput, setMinInput] = useState('')

  const parts = (value || '08:00').split(':')
  const hour24 = Math.max(0, Math.min(23, parseInt(parts[0]) || 0))
  const minute  = Math.max(0, Math.min(59, parseInt(parts[1]) || 0))
  const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12

  const applyHour = (h12: number, ap: 'AM' | 'PM') => {
    let h24 = h12 % 12
    if (ap === 'PM') h24 += 12
    onChange(`${String(h24).padStart(2,'0')}:${String(minute).padStart(2,'0')}`)
  }

  const applyMinute = (m: number) => {
    onChange(`${String(hour24).padStart(2,'0')}:${String(Math.max(0,Math.min(59,m))).padStart(2,'0')}`)
  }

  const CX = 100, CY = 100, R = 85, SIZE = 200

  const toXY = (deg: number, r: number) => ({
    x: CX + r * Math.sin((deg * Math.PI) / 180),
    y: CY - r * Math.cos((deg * Math.PI) / 180),
  })

  const hourDeg   = (hour12 % 12) * 30 + minute * 0.5
  const minuteDeg = minute * 6
  const hourTip   = toXY(hourDeg, 50)
  const minuteTip = toXY(minuteDeg, 68)
  const showMinuteTipLabel = minute % 5 !== 0

  const ticks60 = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0
    return { outer: toXY(i*6, R), inner: toXY(i*6, R-(major?11:5)), major }
  })

  const hourFace = Array.from({ length: 12 }, (_, i) => {
    const num = i === 0 ? 12 : i
    return { num, pos: toXY(i*30, R-19), selected: mode==='hour' && hour12===num }
  })

  const minuteFace = Array.from({ length: 12 }, (_, i) => {
    const val = i * 5
    return { val, pos: toXY(i*30, R-19), selected: mode==='minute' && minute%5===0 && minute===val }
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const SNAP = 22

  const handleClockClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (disabled) return
    const rect = svgRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left - CX
    const y = e.clientY - rect.top  - CY
    let angle = Math.atan2(x, -y) * (180 / Math.PI)
    if (angle < 0) angle += 360
    const nearestIdx = Math.round(angle / 30) % 12
    const nearestAngle = nearestIdx * 30
    let diff = Math.abs(angle - nearestAngle)
    if (diff > 180) diff = 360 - diff
    if (diff > SNAP) return
    if (mode === 'hour') {
      applyHour(nearestIdx === 0 ? 12 : nearestIdx, ampm)
      setTimeout(() => setMode('minute'), 120)
    } else {
      applyMinute(nearestIdx * 5)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ampm, hour24, minute, disabled])

  const commitHour = (raw: string) => {
    const n = parseInt(raw)
    if (!isNaN(n) && n >= 1 && n <= 12) applyHour(n, ampm)
    setEditingHour(false); setHourInput('')
  }

  const commitMin = (raw: string) => {
    const n = parseInt(raw)
    if (!isNaN(n) && n >= 0 && n <= 59) applyMinute(n)
    setEditingMin(false); setMinInput('')
  }

  const btn: React.CSSProperties = {
    width: 52, height: 46, textAlign: 'center', fontSize: 30,
    fontWeight: 900, lineHeight: 1, border: 'none', borderRadius: '0.5rem',
    cursor: disabled ? 'default' : 'pointer', fontVariantNumeric: 'tabular-nums', transition: 'all 0.15s',
  }
  const inp: React.CSSProperties = {
    width: 52, height: 46, textAlign: 'center', fontSize: 30,
    fontWeight: 900, color: '#3b82f6', background: 'rgba(59,130,246,0.12)',
    border: '1.5px solid #3b82f6', borderRadius: '0.5rem', outline: 'none',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, userSelect:'none' }}>

      {/* Mode toggle pills */}
      <div style={{ display:'flex', gap:8 }}>
        {(['hour','minute'] as const).map(m => (
          <button key={m} onClick={() => !disabled && setMode(m)}
            style={{ padding:'3px 14px', borderRadius:'0.5rem', fontSize:10, fontWeight:900,
              letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', transition:'all 0.15s',
              border:`1px solid ${mode===m ? '#3b82f6' : '#1e2435'}`,
              background: mode===m ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: mode===m ? '#60a5fa' : '#4b5563',
            }}
          >{m === 'hour' ? 'Hour' : 'Minute'}</button>
        ))}
      </div>

      {/* Analogue Clock SVG */}
      <svg ref={svgRef} width={SIZE} height={SIZE} onClick={handleClockClick}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', display:'block' }}
      >
        <defs>
          <radialGradient id="atp-g" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#161c2d" />
            <stop offset="100%" stopColor="#0d1018" />
          </radialGradient>
          <filter id="atp-glow">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx={CX} cy={CY} r={R+9} fill="#0d1018" stroke="#1e2435" strokeWidth={1.5}/>
        <circle cx={CX} cy={CY} r={R} fill="url(#atp-g)"/>
        {ticks60.map((t,i) => (
          <line key={i} x1={t.outer.x} y1={t.outer.y} x2={t.inner.x} y2={t.inner.y}
            stroke={t.major ? '#2d3748' : '#1a202e'} strokeWidth={t.major?2:1} strokeLinecap="round"/>
        ))}
        {mode==='hour' && hourFace.map(({num,pos,selected}) => (
          <text key={num} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
            fontSize={selected?14:11} fontWeight="900" fill={selected?'#60a5fa':'#9ca3af'}
          >{num}</text>
        ))}
        {mode==='minute' && minuteFace.map(({val,pos,selected}) => (
          <text key={val} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
            fontSize={selected?13:11} fontWeight="900" fill={selected?'#60a5fa':'#6b7280'}
          >{String(val).padStart(2,'0')}</text>
        ))}
        <line x1={CX} y1={CY} x2={hourTip.x} y2={hourTip.y}
          stroke={mode==='hour'?'#3b82f6':'#94a3b8'} strokeWidth={6} strokeLinecap="round"
          filter={mode==='hour'?'url(#atp-glow)':undefined}/>
        <line x1={CX} y1={CY} x2={minuteTip.x} y2={minuteTip.y}
          stroke={mode==='minute'?'#3b82f6':'#64748b'} strokeWidth={3} strokeLinecap="round"
          filter={mode==='minute'?'url(#atp-glow)':undefined}/>
        {showMinuteTipLabel && (() => {
          const lp = toXY(minuteDeg, 54)
          return <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
            fontSize={10} fontWeight="900" fill="#3b82f6"
            style={{filter:'drop-shadow(0 0 4px rgba(59,130,246,0.8))'}}>
            {String(minute).padStart(2,'0')}
          </text>
        })()}
        <circle cx={CX} cy={CY} r={5} fill="#3b82f6"/>
        <circle cx={CX} cy={CY} r={2} fill="#0d1018"/>
      </svg>

      {/* Digital display — BELOW the clock */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px',
        borderRadius:'0.875rem', backgroundColor:'#0d1018', border:'1px solid #1e2435' }}>
        {editingHour ? (
          <input autoFocus type="number" min={1} max={12} value={hourInput}
            onChange={e => setHourInput(e.target.value)}
            onBlur={() => commitHour(hourInput)}
            onKeyDown={e => { if(e.key==='Enter') commitHour(hourInput); if(e.key==='Escape'){setEditingHour(false);setHourInput('')} }}
            style={inp}/>
        ) : (
          <button title="Tap to type hour"
            onClick={() => { if(!disabled){setMode('hour');setEditingHour(true);setHourInput(String(hour12))} }}
            style={{...btn, color:mode==='hour'?'#3b82f6':'#f1f5f9', background:mode==='hour'?'rgba(59,130,246,0.08)':'transparent', textShadow:mode==='hour'?'0 0 16px rgba(59,130,246,0.5)':'none'}}
          >{String(hour12).padStart(2,'0')}</button>
        )}
        <span style={{fontSize:30,fontWeight:900,color:'#374151',lineHeight:1}}>:</span>
        {editingMin ? (
          <input autoFocus type="number" min={0} max={59} value={minInput}
            onChange={e => { setMinInput(e.target.value); const n=parseInt(e.target.value); if(!isNaN(n)&&n>=0&&n<=59) applyMinute(n) }}
            onBlur={() => commitMin(minInput)}
            onKeyDown={e => { if(e.key==='Enter') commitMin(minInput); if(e.key==='Escape'){setEditingMin(false);setMinInput('')} }}
            style={inp}/>
        ) : (
          <button title="Tap to type minute (0–59)"
            onClick={() => { if(!disabled){setMode('minute');setEditingMin(true);setMinInput(String(minute))} }}
            style={{...btn, color:mode==='minute'?'#3b82f6':'#f1f5f9', background:mode==='minute'?'rgba(59,130,246,0.08)':'transparent', textShadow:mode==='minute'?'0 0 16px rgba(59,130,246,0.5)':'none'}}
          >{String(minute).padStart(2,'0')}</button>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:4,marginLeft:4}}>
          {(['AM','PM'] as const).map(ap => (
            <button key={ap} onClick={() => !disabled && applyHour(hour12, ap)}
              style={{ padding:'3px 8px', borderRadius:'0.4rem', fontSize:11, fontWeight:900,
                background: ampm===ap ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : '#1a1f2e',
                color: ampm===ap ? '#fff' : '#6b7280',
                border:`1px solid ${ampm===ap?'#3b82f6':'#1e2435'}`,
                cursor: disabled?'default':'pointer', transition:'all 0.15s' }}
            >{ap}</button>
          ))}
        </div>
      </div>

      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#374151',textAlign:'center'}}>
        Clock → 5-min marks · Tap digital display to type any value
      </p>
    </div>
  )
}
