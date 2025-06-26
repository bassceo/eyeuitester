"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Camera, Target, CheckCircle, AlertCircle } from "lucide-react"

function CalibrationContent() {
  const searchParams = useSearchParams()
  const [isWebGazerLoaded, setIsWebGazerLoaded] = useState(false)
  const [calibrationStep, setCalibrationStep] = useState(0)
  const [calibrationPoints, setCalibrationPoints] = useState<Array<{ x: number; y: number; completed: boolean }>>([])
  const [currentPoint, setCurrentPoint] = useState(0)
  const [cameraPermission, setCameraPermission] = useState<"pending" | "granted" | "denied">("pending")
  const webgazerRef = useRef<any>(null)

  const websiteUrl = searchParams.get("url") || ""
  const scrollingTime = searchParams.get("time") || "30"

  // Generate calibration points across the screen
  useEffect(() => {
    const points = []
    const margin = 100
    const cols = 4
    const rows = 3

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          x: margin + (col * (window.innerWidth - 2 * margin)) / (cols - 1),
          y: margin + (row * (window.innerHeight - 2 * margin)) / (rows - 1),
          completed: false,
        })
      }
    }
    setCalibrationPoints(points)
  }, [])

  // Load WebGazer
  useEffect(() => {
    const loadWebGazer = async () => {
      // Check if running in browser and if mediaDevices is available
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        console.error('Media devices not available')
        setCameraPermission("denied")
        return
      }

      // Check if we're not on localhost or HTTPS
      const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      
      if (!isLocalhost && !isHttps) {
        console.error('Camera access requires HTTPS in production')
        setCameraPermission("denied")
        return
      }

      try {
        // Request camera permission first
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        })
        setCameraPermission("granted")
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())

        // Load WebGazer script
        const script = document.createElement("script")
        script.src = "https://webgazer.cs.brown.edu/webgazer.js"
        script.async = true
        script.onload = () => {
          if (window.webgazer) {
            window.webgazer
              .setGazeListener((data: any, elapsedTime: number) => {
                // Handle gaze data during calibration
              })
              .begin()
              .catch((err: Error) => {
                console.error('WebGazer initialization failed:', err)
                setCameraPermission("denied")
              })

            webgazerRef.current = window.webgazer
            setIsWebGazerLoaded(true)
          }
        }
        script.onerror = () => {
          console.error('Failed to load WebGazer script')
          setCameraPermission("denied")
        }
        document.head.appendChild(script)
      } catch (error) {
        console.error("Camera access error:", error)
        setCameraPermission("denied")
      }
    }

    loadWebGazer()

    return () => {
      if (webgazerRef.current) {
        webgazerRef.current.end()
      }
    }
  }, [])

  const handleCalibrationClick = (pointIndex: number) => {
    if (webgazerRef.current && pointIndex === currentPoint) {
      const point = calibrationPoints[pointIndex]

      // Add calibration point to WebGazer
      webgazerRef.current.recordScreenPosition(point.x, point.y, "click")

      // Mark point as completed
      const updatedPoints = [...calibrationPoints]
      updatedPoints[pointIndex].completed = true
      setCalibrationPoints(updatedPoints)

      // Move to next point
      if (currentPoint < calibrationPoints.length - 1) {
        setCurrentPoint(currentPoint + 1)
      } else {
        // Calibration complete
        setCalibrationStep(2)
      }
    }
  }

  const startAnalysis = () => {
    // Сохраняем состояние WebGazer в localStorage для передачи на следующую страницу
    if (webgazerRef.current) {
      localStorage.setItem("webgazer_calibrated", "true")
    }

    const params = new URLSearchParams({
      url: websiteUrl,
      time: scrollingTime,
    })
    window.location.href = `/analysis?${params.toString()}`
  }

  if (cameraPermission === "denied") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Доступ к камере отклонен
            </CardTitle>
            <CardDescription>Для работы системы необходим доступ к веб-камере</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Пожалуйста, разрешите доступ к камере в настройках браузера и обновите страницу.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Обновить страницу
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Калибровка системы</h1>
          <p className="text-gray-600">Для точного отслеживания взгляда необходимо откалибровать камеру</p>
        </div>

        {/* Progress */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Прогресс калибровки</span>
              <span className="text-sm text-gray-500">
                {calibrationPoints.filter((p) => p.completed).length} / {calibrationPoints.length}
              </span>
            </div>
            <Progress
              value={(calibrationPoints.filter((p) => p.completed).length / calibrationPoints.length) * 100}
              className="w-full"
            />
          </CardContent>
        </Card>

        {!isWebGazerLoaded ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Camera className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Инициализация камеры...</h3>
              <p className="text-gray-600">Пожалуйста, подождите</p>
            </CardContent>
          </Card>
        ) : calibrationStep < 2 ? (
          <div className="relative">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Калибровка взгляда
                </CardTitle>
                <CardDescription>
                  Нажимайте на красные точки в порядке их появления. Смотрите на точку во время клика.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Calibration overlay */}
            <div className="fixed inset-0 z-50 pointer-events-none">
              {calibrationPoints.map((point, index) => (
                <div
                  key={index}
                  className={`absolute w-8 h-8 rounded-full border-4 transition-all duration-300 ${
                    point.completed
                      ? "bg-green-500 border-green-600"
                      : index === currentPoint
                        ? "bg-red-500 border-red-600 animate-pulse pointer-events-auto cursor-pointer scale-125"
                        : "bg-gray-300 border-gray-400"
                  }`}
                  style={{
                    left: point.x - 16,
                    top: point.y - 16,
                  }}
                  onClick={() => handleCalibrationClick(index)}
                />
              ))}
            </div>

            {/* Instructions */}
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-sm">
                    {currentPoint < calibrationPoints.length
                      ? `Нажмите на красную точку (${currentPoint + 1}/${calibrationPoints.length})`
                      : "Калибровка завершена!"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Калибровка завершена
              </CardTitle>
              <CardDescription>Система готова к анализу веб-сайта: {websiteUrl}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Параметры анализа:</h4>
                  <ul className="text-sm space-y-1">
                    <li>
                      <strong>URL:</strong> {websiteUrl}
                    </li>
                    <li>
                      <strong>Время скроллинга:</strong> {scrollingTime} секунд
                    </li>
                    <li>
                      <strong>Калибровочных точек:</strong> {calibrationPoints.length}
                    </li>
                  </ul>
                </div>

                <Button onClick={startAnalysis} className="w-full" size="lg">
                  Начать анализ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function CalibrationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CalibrationContent />
    </Suspense>
  )
}
