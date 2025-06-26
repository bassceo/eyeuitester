"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Eye, Timer, Square, AlertTriangle, Loader2 } from "lucide-react"

interface GazePoint {
  x: number
  y: number
  timestamp: number
  scrollY: number
}

// Helper to get scroll position
const getScrollPosition = (): number => {
  if (typeof window === 'undefined') return 0
  return Math.max(
    window.pageYOffset,
    document.documentElement.scrollTop,
    document.body.scrollTop
  )
}

function AnalysisPage() {
  const searchParams = useSearchParams()
  const [state, setState] = useState({
    isAnalyzing: false,
    isComplete: false,
    isInitializing: true,
    webgazerReady: false,
    timeRemaining: 0,
    currentScrollY: 0,
    useProxy: true,
    pageHeight: 0,
    error: null as string | null
  })
  
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const webgazerRef = useRef<any>(null)
  const scrollCheckRef = useRef<NodeJS.Timeout>()
  const analysisTimerRef = useRef<NodeJS.Timeout>()
  const lastScrollY = useRef(0)
  const rafId = useRef<number>()

  const websiteUrl = searchParams.get("url") || ""
  const analysisTime = Number(searchParams.get("time") || "30")

  // Initialize WebGazer
  useEffect(() => {
    const initWebGazer = async () => {
      try {
        if (!window.webgazer) {
          await new Promise((resolve) => {
            const script = document.createElement("script")
            script.src = "https://webgazer.cs.brown.edu/webgazer.js"
            script.onload = resolve
            document.head.appendChild(script)
          })
        }

        if (window.webgazer) {
          webgazerRef.current = window.webgazer
          await webgazerRef.current
            .setGazeListener(handleGazeData)
            .begin()
          
          setState(prev => ({
            ...prev,
            webgazerReady: true,
            isInitializing: false,
            timeRemaining: analysisTime
          }))
        }
      } catch (error) {
        console.error("WebGazer initialization failed:", error)
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: "Не удалось инициализировать отслеживание взгляда"
        }))
      }
    }

    initWebGazer()

    return () => {
      if (webgazerRef.current) {
        webgazerRef.current.pause()
      }
      cleanupTimers()
    }
  }, [analysisTime])

  // Handle scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      if (!rafId.current) {
        rafId.current = window.requestAnimationFrame(() => {
          const scrollY = getScrollPosition()
          if (Math.abs(scrollY - lastScrollY.current) > 1) {
            lastScrollY.current = scrollY
            setState(prev => ({ ...prev, currentScrollY: scrollY }))
          }
          rafId.current = undefined
        })
      }
    }

    // Initial scroll position
    handleScroll()
    
    // Periodic check in case we miss scroll events
    scrollCheckRef.current = setInterval(handleScroll, 100)
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current) {
        window.cancelAnimationFrame(rafId.current)
      }
      if (scrollCheckRef.current) {
        clearInterval(scrollCheckRef.current)
      }
    }
  }, [])

  const handleGazeData = (data: any) => {
    if (!state.isAnalyzing || !data) return
    
    setGazeData(prev => [
      ...prev,
      {
        x: data.x,
        y: data.y,
        timestamp: Date.now(),
        scrollY: lastScrollY.current
      }
    ])
  }

  const startAnalysis = () => {
    if (!state.webgazerReady) return
    
    setState(prev => ({ ...prev, isAnalyzing: true }))
    setGazeData([])
    
    analysisTimerRef.current = setInterval(() => {
      setState(prev => {
        const newTime = prev.timeRemaining - 1
        if (newTime <= 0) {
          clearInterval(analysisTimerRef.current)
          return { ...prev, isAnalyzing: false, isComplete: true, timeRemaining: 0 }
        }
        return { ...prev, timeRemaining: newTime }
      })
    }, 1000)
  }

  const cleanupTimers = () => {
    if (analysisTimerRef.current) clearInterval(analysisTimerRef.current)
    if (scrollCheckRef.current) clearInterval(scrollCheckRef.current)
  }

  const generateHeatmap = () => {
    const analysisData = {
      url: websiteUrl,
      gazeData,
      analysisTime,
      timestamp: Date.now(),
      pageHeight: state.pageHeight || window.innerHeight * 3
    }
    
    localStorage.setItem("gazeAnalysisData", JSON.stringify(analysisData))
    window.location.href = "/results"
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getIframeSrc = () => {
    if (!state.useProxy) return websiteUrl
    
    const width = Math.min(window.innerWidth, 1920)
    const height = Math.min(window.innerHeight, 1080)
    
    return (
      `/api/proxy?url=${encodeURIComponent(websiteUrl)}` +
      `&width=${width}` +
      `&height=${height}` +
      `&deviceScaleFactor=${window.devicePixelRatio || 1}`
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Ошибка
            </CardTitle>
            <CardDescription>{state.error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Попробовать снова
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state.isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p>Инициализация системы отслеживания взгляда...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Control Panel */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Eye className={`w-5 h-5 ${state.webgazerReady ? "text-green-600" : "text-gray-400"}`} />
                <span>Отслеживание {state.webgazerReady ? "активно" : "не активно"}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Square className="w-4 h-4" />
                <span>Точек: {gazeData.length}</span>
              </div>

              <div className="text-sm text-gray-600">
                Скролл: {Math.round(state.currentScrollY)}px
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!state.isAnalyzing && !state.isComplete && state.webgazerReady && (
                <Button onClick={startAnalysis} size="sm">
                  Начать анализ
                </Button>
              )}

              {state.isAnalyzing && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-blue-500" />
                    <span className="font-mono text-lg font-bold text-blue-600">
                      {formatTime(state.timeRemaining)}
                    </span>
                  </div>
                  <Progress 
                    value={((analysisTime - state.timeRemaining) / analysisTime) * 100} 
                    className="w-32" 
                  />
                </div>
              )}

              {state.isComplete && (
                <Button 
                  onClick={generateHeatmap} 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700"
                >
                  Создать тепловую карту ({gazeData.length} точек)
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Website Display */}
      <div className="pt-16 h-[calc(100vh-4rem)]">
        {state.isComplete ? (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-green-600">Анализ завершен!</CardTitle>
                <CardDescription>Собрано {gazeData.length} точек данных о взгляде</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Статистика:</h4>
                    <ul className="text-sm space-y-1">
                      <li><strong>Время анализа:</strong> {analysisTime} секунд</li>
                      <li><strong>Точек взгляда:</strong> {gazeData.length}</li>
                      <li>
                        <strong>Частота:</strong>{" "}
                        {gazeData.length > 0 
                          ? (gazeData.length / analysisTime).toFixed(1) 
                          : "0"} точек/сек
                      </li>
                    </ul>
                  </div>
                  <Button 
                    onClick={generateHeatmap} 
                    className="w-full" 
                    size="lg"
                  >
                    Создать тепловую карту
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full relative">
            <div className="h-full overflow-auto">
              <iframe
                ref={iframeRef}
                src={getIframeSrc()}
                className="w-full border-0"
                style={{ height: `${Math.max(state.pageHeight, window.innerHeight * 2)}px` }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                title="Website Analysis"
                onLoad={() => {
                  // Update page height after iframe loads
                  if (iframeRef.current?.contentWindow) {
                    const height = Math.max(
                      iframeRef.current.contentWindow.document.body.scrollHeight,
                      iframeRef.current.contentWindow.document.documentElement.scrollHeight
                    )
                    setState(prev => ({ ...prev, pageHeight: height }))
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalysisPage
