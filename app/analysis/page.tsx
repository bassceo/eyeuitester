"use client"

import { useEffect, useState, useRef, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Eye, Timer, Square, AlertTriangle } from "lucide-react"

interface GazePoint {
  x: number
  y: number
  timestamp: number
  scrollY: number
}

function AnalysisContent() {
  const searchParams = useSearchParams()
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [webgazerReady, setWebgazerReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [pageHeight, setPageHeight] = useState(0)
  const [currentScrollY, setCurrentScrollY] = useState(0)
  const [useProxy, setUseProxy] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const webgazerRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout>()
  const isAnalyzingRef = useRef(false)
  const currentScrollYRef = useRef(0)

  const websiteUrl = searchParams.get("url") || ""
  const scrollingTime = Number.parseInt(searchParams.get("time") || "30")

  // Sync refs with state
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing
  }, [isAnalyzing])

  useEffect(() => {
    currentScrollYRef.current = currentScrollY
  }, [currentScrollY])

  // Gaze listener callback
  const gazeListener = useCallback((data: any, elapsedTime: number) => {
    if (data && isAnalyzingRef.current) {
      console.log(
        "Gaze data received:",
        data,
        "Analyzing:",
        isAnalyzingRef.current,
        "ScrollY:",
        currentScrollYRef.current,
      )
      setGazeData((prev) => {
        const newPoint = {
          x: data.x,
          y: data.y,
          timestamp: Date.now(),
          scrollY: currentScrollYRef.current,
        }
        console.log("Adding gaze point:", newPoint)
        return [...prev, newPoint]
      })
    }
  }, [])

  // Initialize WebGazer
  useEffect(() => {
    const initializeWebGazer = async () => {
      try {
        if (!window.webgazer) {
          const script = document.createElement("script")
          script.src = "https://webgazer.cs.brown.edu/webgazer.js"
          script.onload = () => {
            setupWebGazer()
          }
          document.head.appendChild(script)
        } else {
          setupWebGazer()
        }
      } catch (error) {
        console.error("Error initializing WebGazer:", error)
        setIsInitializing(false)
      }
    }

    const setupWebGazer = () => {
      if (window.webgazer) {
        webgazerRef.current = window.webgazer

        window.webgazer
          .setGazeListener(gazeListener)
          .begin()
          .then(() => {
            console.log("WebGazer initialized successfully")
            setWebgazerReady(true)
            setIsInitializing(false)
            setTimeRemaining(scrollingTime)
          })
          .catch((error: any) => {
            console.error("WebGazer initialization failed:", error)
            setIsInitializing(false)
          })
      }
    }

    initializeWebGazer()

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [gazeListener, scrollingTime])

  // Track scroll position of main window
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0
      setCurrentScrollY(scrollY)
      console.log("Main window scroll updated:", scrollY)
    }

    // Обработчик сообщений от iframe (для прокси)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "scroll") {
        const scrollY = event.data.scrollY
        setCurrentScrollY(scrollY)
        console.log("Received scroll from iframe via postMessage:", scrollY)
      }
    }

    window.addEventListener("scroll", handleScroll)
    window.addEventListener("message", handleMessage)

    // Начальная позиция
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("message", handleMessage)
    }
  }, [])

  const startAnalysis = () => {
    if (!webgazerReady) {
      alert("WebGazer не готов. Пожалуйста, подождите.")
      return
    }

    console.log("Starting analysis...")
    setIsAnalyzing(true)
    setGazeData([])
    setTimeRemaining(scrollingTime)

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        console.log("Time remaining:", prev - 1)
        if (prev <= 1) {
          console.log("Analysis complete!")
          setIsAnalyzing(false)
          setIsComplete(true)
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const generateHeatmap = async () => {
    console.log("Generating heatmap with", gazeData.length, "points")
    
    // Save gaze data to localStorage temporarily
    const analysisData = {
      gazeData: gazeData,
      analysisTime: scrollingTime,
      timestamp: Date.now(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: pageHeight || window.innerHeight * 3,
    };
    
    localStorage.setItem('gazeAnalysisData', JSON.stringify(analysisData));
    
    // Navigate to results page with just the URL
    window.location.href = `/results?url=${encodeURIComponent(websiteUrl)}`;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleIframeLoad = () => {
    console.log("Website loaded")

    if (useProxy) {
      // Для прокси-версии пытаемся получить высоту и добавить скрипт
      try {
        if (iframeRef.current?.contentWindow?.document) {
          const height = Math.max(
            iframeRef.current.contentWindow.document.body.scrollHeight,
            iframeRef.current.contentWindow.document.documentElement.scrollHeight,
          )
          setPageHeight(height)
          console.log("Page height detected:", height)

          // Добавляем скрипт для отслеживания скролла
          const script = iframeRef.current.contentWindow.document.createElement("script")
          script.textContent = `
            console.log('Scroll tracking script injected');
            let lastScrollY = 0;
            
            function trackScroll() {
              const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
              if (currentScrollY !== lastScrollY) {
                lastScrollY = currentScrollY;
                console.log('Iframe scroll:', currentScrollY);
                try {
                  window.parent.postMessage({
                    type: 'scroll',
                    scrollY: currentScrollY
                  }, '*');
                } catch(e) {
                  console.log('PostMessage error:', e);
                }
              }
            }
            
            window.addEventListener('scroll', trackScroll, { passive: true });
            document.addEventListener('scroll', trackScroll, { passive: true });
            setInterval(trackScroll, 100);
            setTimeout(trackScroll, 100);
          `
          iframeRef.current.contentWindow.document.head.appendChild(script)
          console.log("Scroll tracking script added to iframe")
        }
      } catch (error) {
        console.log("Cannot access iframe content, falling back to main window scroll")
        setPageHeight(window.innerHeight * 3)
        setUseProxy(false)
      }
    } else {
      // Для обычного iframe используем высоту основного окна
      setPageHeight(window.innerHeight * 3)
    }
  }

  const getIframeSrc = () => {
    if (useProxy) {
      return `/api/proxy?url=${encodeURIComponent(websiteUrl)}`
    }
    return websiteUrl
  }

  if (!websiteUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Ошибка
            </CardTitle>
            <CardDescription>URL веб-сайта не указан</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/")} className="w-full">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Eye className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">Инициализация системы отслеживания взгляда...</h3>
            <p className="text-gray-600">Пожалуйста, подождите</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Control Panel */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Eye className={`w-5 h-5 ${webgazerReady ? "text-green-600" : "text-gray-400"}`} />
                <span className="font-semibold">Анализ взгляда {webgazerReady ? "(Готов)" : "(Инициализация...)"}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Square className="w-4 h-4" />
                <span>Точек взгляда: {gazeData.length}</span>
              </div>

              <div className="text-sm text-gray-600">Скролл: {currentScrollY}px</div>
              <div className="text-sm text-gray-500">{useProxy ? "Режим: Прокси" : "Режим: Прямой"}</div>
            </div>

            <div className="flex items-center gap-4">
              {!isAnalyzing && !isComplete && webgazerReady && (
                <Button onClick={startAnalysis} size="sm">
                  Начать анализ
                </Button>
              )}

              {!webgazerReady && <div className="text-sm text-orange-600">Ожидание инициализации камеры...</div>}

              {isAnalyzing && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-orange-500" />
                    <span className="font-mono text-lg font-bold text-orange-600">{formatTime(timeRemaining)}</span>
                  </div>
                  <Progress value={((scrollingTime - timeRemaining) / scrollingTime) * 100} className="w-32" />
                </div>
              )}

              {isComplete && (
                <Button onClick={generateHeatmap} size="sm" className="bg-green-600 hover:bg-green-700">
                  Создать тепловую карту ({gazeData.length} точек)
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Website Display */}
      <div className="pt-16" style={{ height: "calc(100vh - 4rem)" }}>
        {isComplete ? (
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
                      <li>
                        <strong>Время анализа:</strong> {scrollingTime} секунд
                      </li>
                      <li>
                        <strong>Точек взгляда:</strong> {gazeData.length}
                      </li>
                      <li>
                        <strong>Частота:</strong>{" "}
                        {gazeData.length > 0 ? (gazeData.length / scrollingTime).toFixed(1) : "0"} точек/сек
                      </li>
                    </ul>
                  </div>

                  <Button onClick={generateHeatmap} className="w-full" size="lg">
                    Создать тепловую карту
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="relative h-full">
            {/* Контейнер для iframe с возможностью скролла */}
            <div className="h-full overflow-auto">
              <iframe
                ref={iframeRef}
                src={getIframeSrc()}
                className="w-full border-0"
                style={{ height: `${Math.max(pageHeight, window.innerHeight * 2)}px` }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                title="Website Analysis"
                onLoad={handleIframeLoad}
                onError={() => {
                  console.log("Iframe failed to load, switching to direct mode")
                  setUseProxy(false)
                }}
              />
            </div>

            {webgazerReady && !isAnalyzing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <Card className="max-w-md">
                  <CardContent className="pt-6 text-center">
                    <Eye className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Готов к анализу</h3>
                    <p className="text-gray-600 mb-4">
                      Нажмите "Начать анализ" в верхней панели, чтобы начать отслеживание взгляда.
                    </p>
                    <p className="text-sm text-gray-500">
                      {useProxy
                        ? "Используется прокси-режим для обхода CORS ограничений."
                        : "Скроллите основную страницу для изменения позиции."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gaze Visualization Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 pointer-events-none z-40">
          {gazeData.slice(-5).map((point, index) => (
            <div
              key={`${point.timestamp}-${index}`}
              className="absolute w-4 h-4 bg-red-500 rounded-full opacity-70 animate-ping"
              style={{
                left: point.x - 8,
                top: point.y - 8,
                animationDelay: `${index * 200}ms`,
                animationDuration: "1s",
              }}
            />
          ))}
        </div>
      )}

      {/* Debug info */}
      <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs">
        <div>WebGazer Ready: {webgazerReady ? "Yes" : "No"}</div>
        <div>Analyzing: {isAnalyzing ? "Yes" : "No"}</div>
        <div>Time: {timeRemaining}s</div>
        <div>Gaze Points: {gazeData.length}</div>
        <div>Scroll Y: {currentScrollY}px</div>
        <div>Mode: {useProxy ? "Proxy" : "Direct"}</div>
        <div>Page Height: {pageHeight}px</div>
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AnalysisContent />
    </Suspense>
  )
}
