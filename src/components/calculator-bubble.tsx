'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calculator, X } from 'lucide-react'

export default function CalculatorBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [position, setPosition] = useState({ x: 20, y: 500 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const bubbleRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedPos = localStorage.getItem('calc_bubble_pos')
    if (savedPos) {
      const pos = JSON.parse(savedPos)
      setPosition(pos)
    } else {
      setPosition({ x: 20, y: window.innerHeight - 350 })
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && popupRef.current && !popupRef.current.contains(e.target as Node) && bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // Calculate which side is closer
      const screenWidth = window.innerWidth
      const midPoint = screenWidth / 2
      
      let finalX = newX
      if (newX < midPoint) {
        // Snap to left side (20px from left)
        finalX = 20
      } else {
        // Snap to right side (20px from right)
        finalX = screenWidth - 80
      }
      
      // Keep within vertical bounds
      const finalY = Math.max(60, Math.min(newY, window.innerHeight - 100))
      
      setPosition({ x: finalX, y: finalY })
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        localStorage.setItem('calc_bubble_pos', JSON.stringify(position))
      }
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, position])

  const handleNumber = (num: string) => {
    setDisplay(prev => prev === '0' ? num : prev + num)
  }

  const handleOperator = (op: string) => {
    setDisplay(prev => prev + ' ' + op + ' ')
  }

  const handleClear = () => {
    setDisplay('0')
  }

  const handleCalculate = () => {
    try {
      const result = eval(display)
      setDisplay(String(result))
    } catch {
      setDisplay('Error')
    }
  }

  const handleAppendZeros = (zeros: number) => {
    setDisplay(prev => {
      if (prev === '0') return '0'.repeat(zeros)
      return prev + '0'.repeat(zeros)
    })
  }

  const handleMultiply = (multiplier: number) => {
    setDisplay(prev => {
      const current = parseFloat(prev) || 0
      return String(current * multiplier)
    })
  }

  return (
    <>
      {/* Bubble Button */}
      <div
        ref={bubbleRef}
        onMouseDown={handleMouseDown}
        onClick={() => !isDragging && setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'transform 0.2s, left 0.3s ease-out'
        }}
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-110 transition-transform ${isOpen ? 'hidden' : ''}`}
      >
        <Calculator className="text-white w-7 h-7" />
      </div>

      {/* Calculator Popup */}
      {isOpen && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            left: position.x > window.innerWidth / 2 ? position.x - 320 : position.x + 20,
            top: Math.max(20, position.y - 320),
            zIndex: 9999
          }}
          className="w-80 bg-[#111520] border border-[#1e2435] rounded-2xl shadow-2xl p-4"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Calculator</span>
            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Display */}
          <div className="bg-zinc-900 rounded-xl p-4 mb-3">
            <div className="text-right text-2xl font-black text-white break-all">
              {display}
            </div>
          </div>

          {/* Calculator Buttons */}
          <div className="grid grid-cols-5 gap-2">
            {/* Row 1 */}
            <button onClick={handleClear} className="h-12 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm transition-all">C</button>
            <button onClick={() => handleNumber('7')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">7</button>
            <button onClick={() => handleNumber('4')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">4</button>
            <button onClick={() => handleNumber('1')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">1</button>
            <button onClick={() => handleOperator('/')} className="h-12 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg transition-all">÷</button>

            {/* Row 2 */}
            <button onClick={() => handleNumber('8')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">8</button>
            <button onClick={() => handleNumber('5')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">5</button>
            <button onClick={() => handleNumber('2')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">2</button>
            <button onClick={() => handleNumber('0')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">0</button>
            <button onClick={() => handleOperator('*')} className="h-12 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg transition-all">×</button>

            {/* Row 3 */}
            <button onClick={() => handleNumber('9')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">9</button>
            <button onClick={() => handleNumber('6')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">6</button>
            <button onClick={() => handleNumber('3')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">3</button>
            <button onClick={() => handleAppendZeros(2)} className="h-12 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-400 font-bold text-sm transition-all">00</button>
            <button onClick={() => handleOperator('-')} className="h-12 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg transition-all">−</button>

            {/* Row 4 */}
            <button onClick={() => handleAppendZeros(3)} className="h-12 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-400 font-bold text-sm transition-all">000</button>
            <button onClick={() => handleOperator('.')} className="h-12 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-white font-bold text-lg transition-all">.</button>
            <button onClick={() => handleMultiply(100)} className="h-10 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl text-green-400 font-bold text-xs transition-all">×100</button>
            <button onClick={() => handleMultiply(1000)} className="h-10 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl text-green-400 font-bold text-xs transition-all">×1000</button>
            <button onClick={() => handleOperator('+')} className="h-12 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg transition-all">+</button>

            {/* Row 5 - Equal button */}
            <button onClick={() => handleMultiply(10000)} className="h-12 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl text-green-400 font-bold text-xs transition-all col-span-4">×10000</button>
            <button onClick={handleCalculate} className="h-12 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-xl transition-all">=</button>
          </div>
        </div>
      )}
    </>
  )
}
