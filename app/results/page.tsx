"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileImage, FileText, Eye, BarChart3, AlertTriangle } from "lucide-react"

interface GazePoint {
  x: number
  y: number
  timestamp: number
  scrollY: number
}

interface AnalysisData {
  url: string
  gazeData: GazePoint[]
  analysisTime: number
  timestamp: number
  pageHeight: number
}

export default function ResultsPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [heatmapGenerated, setHeatmapGenerated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    try {
      const savedData = localStorage.getItem("gazeAnalysisData")
      if (savedData) {
        const data: AnalysisData = JSON.parse(savedData)
        setAnalysisData(data)
        console.log("Loaded analysis data:", data)
      } else {
        setError("Данные анализа не найдены")
      }
    } catch (error) {
      console.error("Error loading analysis data:", error)
      setError("Ошибка загрузки данных анализа")
    }
  }, [])

  const generateMockWebsiteBackground = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, url: string) => {
    const fullHeight = canvas.height

    // Background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Header
    ctx.fillStyle = "#f8f9fa"
    ctx.fillRect(0, 0, canvas.width, 80)
    ctx.fillStyle = "#333333"
    ctx.font = "16px Arial"
    ctx.fillText(`Анализируемый сайт: ${url}`, 20, 50)

    // Content sections
    const sectionHeight = 200
    const sections = Math.floor(fullHeight / sectionHeight)

    for (let i = 0; i < sections; i++) {
      const y = 100 + i * sectionHeight

      // Section background
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f8f9fa"
      ctx.fillRect(0, y, canvas.width, sectionHeight - 20)

      // Section border
      ctx.strokeStyle = "#e0e0e0"
      ctx.lineWidth = 1
      ctx.strokeRect(20, y + 10, canvas.width - 40, sectionHeight - 40)

      // Section title
      ctx.fillStyle = "#333333"
      ctx.font = "18px Arial"
      ctx.fillText(`Секция ${i + 1}`, 40, y + 40)

      // Section content
      ctx.font = "14px Arial"
      ctx.fillStyle = "#666666"
      for (let j = 0; j < 5; j++) {
        const lineY = y + 70 + j * 20
        ctx.fillText(`Содержимое строки ${j + 1} в секции ${i + 1}`, 40, lineY)
      }
    }
  }

  const generateHeatmap = async () => {
    if (!canvasRef.current || !analysisData) return

    setIsGenerating(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        throw new Error("Не удалось получить контекст canvas")
      }

      // Set canvas size to full page height
      const fullHeight = Math.max(analysisData.pageHeight, window.innerHeight * 2)
      canvas.width = window.innerWidth
      canvas.height = fullHeight

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Generate mock website background
      generateMockWebsiteBackground(canvas, ctx, analysisData.url)

      // Create heatmap overlay
      const heatmapCanvas = document.createElement("canvas")
      const heatmapCtx = heatmapCanvas.getContext("2d")

      if (!heatmapCtx) return

      heatmapCanvas.width = canvas.width
      heatmapCanvas.height = canvas.height

      const imageData = heatmapCtx.createImageData(canvas.width, canvas.height)
      const data = imageData.data

      // Initialize with transparent pixels
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0 // Red
        data[i + 1] = 0 // Green
        data[i + 2] = 0 // Blue
        data[i + 3] = 0 // Alpha
      }

      console.log("Generating heatmap from", analysisData.gazeData.length, "gaze points")

      // Create heat map from gaze data, accounting for scroll position
      analysisData.gazeData.forEach((point, index) => {
        const radius = 40
        const intensity = 0.4

        // Adjust Y coordinate based on scroll position
        const adjustedY = point.y + point.scrollY

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance <= radius) {
              const x = Math.round(point.x + dx)
              const y = Math.round(adjustedY + dy)

              if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                const pixelIndex = (y * canvas.width + x) * 4
                const alpha = intensity * (1 - distance / radius)

                // Accumulate heat values
                const currentAlpha = data[pixelIndex + 3] / 255
                const newAlpha = Math.min(currentAlpha + alpha, 1)

                // Create heat gradient (blue -> green -> yellow -> red)
                if (newAlpha < 0.25) {
                  data[pixelIndex] = 0
                  data[pixelIndex + 1] = 0
                  data[pixelIndex + 2] = 255
                } else if (newAlpha < 0.5) {
                  data[pixelIndex] = 0
                  data[pixelIndex + 1] = 255
                  data[pixelIndex + 2] = 0
                } else if (newAlpha < 0.75) {
                  data[pixelIndex] = 255
                  data[pixelIndex + 1] = 255
                  data[pixelIndex + 2] = 0
                } else {
                  data[pixelIndex] = 255
                  data[pixelIndex + 1] = 0
                  data[pixelIndex + 2] = 0
                }

                data[pixelIndex + 3] = Math.min(newAlpha * 255, 255)
              }
            }
          }
        }
      })

      heatmapCtx.putImageData(imageData, 0, 0)

      // Composite heatmap over background
      ctx.globalCompositeOperation = "multiply"
      ctx.globalAlpha = 0.7
      ctx.drawImage(heatmapCanvas, 0, 0)
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1

      setHeatmapGenerated(true)
      console.log("Heatmap generated successfully")
    } catch (error) {
      console.error("Error generating heatmap:", error)
      setError("Ошибка при создании тепловой карты")
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadPNG = async () => {
    if (!canvasRef.current || !analysisData) return

    try {
      const link = document.createElement("a")
      link.download = `heatmap-${new Date().toISOString().split("T")[0]}.png`
      link.href = canvasRef.current.toDataURL()
      link.click()
    } catch (error) {
      console.error("Error downloading PNG:", error)
      setError("Ошибка при скачивании PNG")
    }
  }

  const downloadPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf")

      if (!canvasRef.current || !analysisData) return

      const canvas = canvasRef.current
      const imgData = canvas.toDataURL("image/png")

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      })

      // Add title page
      pdf.setFontSize(20)
      pdf.text(`Тепловая карта взглядов`, 20, 40)

      pdf.setFontSize(14)
      pdf.text(`URL: ${analysisData.url}`, 20, 70)
      pdf.text(`Дата анализа: ${new Date(analysisData.timestamp).toLocaleString()}`, 20, 90)
      pdf.text(`Время анализа: ${analysisData.analysisTime} секунд`, 20, 110)
      pdf.text(`Количество точек взгляда: ${analysisData.gazeData.length}`, 20, 130)

      // Add heatmap image on new page
      pdf.addPage([canvas.width, canvas.height])
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height)

      pdf.save(`heatmap-${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (error) {
      console.error("Error downloading PDF:", error)
      setError("Ошибка при скачивании PDF")
    }
  }

  const getHeatmapStats = () => {
    if (!analysisData || analysisData.gazeData.length === 0) return null

    const gazeData = analysisData.gazeData
    const totalTime = analysisData.analysisTime

    const avgX = gazeData.reduce((sum, point) => sum + point.x, 0) / gazeData.length
    const avgY = gazeData.reduce((sum, point) => sum + point.y + point.scrollY, 0) / gazeData.length

    // Calculate scroll statistics
    const scrollPositions = gazeData.map((point) => point.scrollY)
    const maxScroll = Math.max(...scrollPositions)
    const avgScroll = scrollPositions.reduce((sum, scroll) => sum + scroll, 0) / scrollPositions.length

    return {
      totalPoints: gazeData.length,
      totalTime: totalTime.toString(),
      avgPosition: { x: avgX.toFixed(0), y: avgY.toFixed(0) },
      frequency: (gazeData.length / totalTime).toFixed(1),
      maxScroll: maxScroll.toFixed(0),
      avgScroll: avgScroll.toFixed(0),
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Ошибка
            </CardTitle>
            <CardDescription>{error}</CardDescription>
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

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">Загрузка данных...</h3>
            <p className="text-gray-600">Пожалуйста, подождите</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = getHeatmapStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Eye className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900">Результаты анализа</h1>
          </div>
          <p className="text-xl text-gray-600">
            Тепловая карта взглядов для: <span className="font-semibold">{analysisData.url}</span>
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Heatmap Display */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Тепловая карта взглядов (с учетом скролла)
                </CardTitle>
                <CardDescription>Визуализация областей внимания пользователя на полной высоте страницы</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="w-full max-h-96 object-top object-contain"
                    style={{ maxHeight: "600px" }}
                  />

                  {!heatmapGenerated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <Button
                        onClick={generateHeatmap}
                        disabled={isGenerating}
                        size="lg"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isGenerating ? "Генерация..." : "Создать тепловую карту"}
                      </Button>
                    </div>
                  )}
                </div>

                {heatmapGenerated && (
                  <div className="flex gap-2 mt-4">
                    <Button onClick={downloadPNG} variant="outline" className="flex-1">
                      <FileImage className="w-4 h-4 mr-2" />
                      Скачать PNG
                    </Button>
                    <Button onClick={downloadPDF} variant="outline" className="flex-1">
                      <FileText className="w-4 h-4 mr-2" />
                      Скачать PDF
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistics Panel */}
          <div className="space-y-6">
            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Статистика анализа</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalPoints}</div>
                      <div className="text-sm text-gray-600">Точек взгляда</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{stats.totalTime}с</div>
                      <div className="text-sm text-gray-600">Время анализа</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Частота:</span>
                      <span className="font-semibold">{stats.frequency} точек/сек</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Центр внимания:</span>
                      <span className="font-semibold">
                        ({stats.avgPosition.x}, {stats.avgPosition.y})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Макс. скролл:</span>
                      <span className="font-semibold">{stats.maxScroll}px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Средний скролл:</span>
                      <span className="font-semibold">{stats.avgScroll}px</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle>Легенда тепловой карты</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm">Низкое внимание</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm">Умеренное внимание</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span className="text-sm">Высокое внимание</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-sm">Максимальное внимание</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={() => (window.location.href = "/")} variant="outline" className="w-full">
                  Новый анализ
                </Button>
                <Button onClick={() => window.print()} variant="outline" className="w-full">
                  Печать отчета
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
